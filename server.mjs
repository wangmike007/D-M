#!/usr/bin/env node
/**
 * 鲸聊 · 本机 API 代理与静态文件服务
 *
 * 设计原则：
 *  - 只监听 127.0.0.1，不对外网开放。
 *  - API Key 只从当次请求的 x-api-key 头读取，不落盘、不写日志。
 *  - 聊天流原样转发上游 SSE，方便后续直接接入联网、文件等全家桶能力。
 */

import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3210);
const MAX_BODY = 8 * 1024 * 1024;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

if (!LOOPBACK_HOSTS.has(HOST)) {
  console.error('拒绝启动：D&M 只允许绑定本机回环地址，不能暴露到局域网或公网。');
  process.exit(1);
}

const ALLOWED_HOSTS = new Set([
  `127.0.0.1:${PORT}`,
  `localhost:${PORT}`,
  `[::1]:${PORT}`,
]);
const ALLOWED_ORIGINS = new Set([
  `http://127.0.0.1:${PORT}`,
  `http://localhost:${PORT}`,
  `http://[::1]:${PORT}`,
]);
const VERSION = '0.56.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function securityHeaders(extra = {}) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "media-src 'self' blob:",
      "connect-src 'self'",
      "worker-src 'self'",
      "manifest-src 'self'",
      "object-src 'none'",
      "frame-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
    ...extra,
  };
}

function assertLocalRequest(req) {
  const host = String(req.headers.host || '');
  if (!ALLOWED_HOSTS.has(host)) {
    throw new HttpError(421, '仅允许本机回环地址访问。');
  }

  if (!req.url.startsWith('/api/')) return;
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    throw new HttpError(403, '跨站请求已拒绝。');
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, payload) {
  if (res.headersSent) return;
  const body = JSON.stringify(payload);
  res.writeHead(status, securityHeaders({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  }));
  res.end(body);
}

function getApiKey(req) {
  const raw = String(req.headers['x-api-key'] || '').trim();
  const key = raw.replace(/^Bearer\s+/i, '').trim();
  if (!key) throw new HttpError(401, '缺少 API Key，请先在设置里填写。');
  if (key.length > 4096) throw new HttpError(400, 'API Key 长度异常。');
  return key;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, '请求体过大。'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(new HttpError(400, '请求体不是合法 JSON。'));
      }
    });
    req.on('error', reject);
  });
}

function normalizeBase(raw) {
  const value = String(raw || 'https://api.deepseek.com').trim();
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(400, 'Base URL 不合法。');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new HttpError(400, 'Base URL 只能使用 http 或 https。');
  }
  if (url.protocol === 'http:' && !['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new HttpError(400, '远程 Base URL 必须使用 HTTPS；http 仅允许本机调试地址。');
  }
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/+$/, '');
}

function apiRoot(base) {
  return base
    .replace(/\/+$/, '')
    .replace(/\/(chat\/completions|models|user\/balance)$/i, '');
}

function apiOrigin(base) {
  return new URL(base).origin;
}

function fileEndpoint(base) {
  return `${apiOrigin(base)}/files`;
}

function toolEndpoint(base, name) {
  return `${apiOrigin(base)}/v1/tools/${name}`;
}

function normalizeContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;

  const parts = [];
  for (const part of content) {
    if (!part || typeof part !== 'object') continue;
    if (part.type === 'text' && typeof part.text === 'string' && part.text) {
      parts.push({ type: 'text', text: part.text });
    } else if (part.type === 'file' && typeof part.file_id === 'string' && part.file_id) {
      parts.push({ type: 'file', file_id: part.file_id });
    }
  }
  return parts.length ? parts : null;
}

function normalizeMessages(raw) {
  if (!Array.isArray(raw)) return [];
  const messages = [];

  for (const message of raw) {
    if (!message || !['system', 'user', 'assistant'].includes(message.role)) continue;
    const content = normalizeContent(message.content);
    if (content === null) continue;
    if (typeof content === 'string' && !content) continue;
    if (Array.isArray(content) && content.length === 0) continue;

    const clean = { role: message.role, content };
    if (message.role === 'assistant') {
      if (typeof message.reasoning_content === 'string' && message.reasoning_content) {
        clean.reasoning_content = message.reasoning_content;
      }
      if (Array.isArray(message.server_tool_calls)) {
        clean.server_tool_calls = message.server_tool_calls;
      }
    }
    messages.push(clean);
  }

  return messages;
}

function readBuffer(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, '文件过大。'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function baseFromQuery(req) {
  const url = new URL(req.url, 'http://localhost');
  return normalizeBase(url.searchParams.get('baseUrl') || 'https://api.deepseek.com');
}

async function readUpstreamJson(upstream) {
  const text = await upstream.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text.slice(0, 2000) || `上游返回 HTTP ${upstream.status}` } };
  }
}

async function handleChat(req, res) {
  const key = getApiKey(req);
  const payload = await readJson(req);

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    throw new HttpError(400, 'messages 不能为空。');
  }
  if (!payload.model || typeof payload.model !== 'string') {
    throw new HttpError(400, '缺少 model。');
  }

  const base = normalizeBase(payload.baseUrl);
  const messages = normalizeMessages(payload.messages);

  if (messages.length === 0) throw new HttpError(400, '没有可发送的消息。');

  const body = {
    model: payload.model,
    messages,
    stream: true,
  };

  const thinkingLevel = ['none', 'low', 'high', 'max'].includes(payload.thinkingLevel)
    ? payload.thinkingLevel
    : null;
  if (thinkingLevel) {
    body.reasoning_effort = thinkingLevel;
  } else if (typeof payload.thinking === 'boolean') {
    body.reasoning_effort = payload.thinking ? 'high' : 'none';
  }

  if (payload.webSearch === true && /deepseek-flash/i.test(payload.model)) {
    body.tools = [
      { type: 'deepseek_web_search' },
      { type: 'deepseek_read_url' },
    ];
  }
  if (Number.isFinite(payload.maxTokens)) {
    body.max_tokens = Math.max(1, Math.min(393216, Math.floor(payload.maxTokens)));
  }

  const controller = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.on('close', onClose);

  let upstream;
  try {
    upstream = await fetch(`${apiRoot(base)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) return;
    throw new HttpError(502, '连不上 API 服务，请检查网络或 Base URL。');
  }

  if (!upstream.ok) {
    const data = await readUpstreamJson(upstream);
    sendJson(res, upstream.status, data);
    return;
  }

  if (!upstream.body) {
    throw new HttpError(502, '上游没有返回内容。');
  }

  const upstreamType = upstream.headers.get('content-type') || '';
  if (upstreamType && !upstreamType.includes('text/event-stream')) {
    const data = await readUpstreamJson(upstream);
    if (data?.error) {
      sendJson(res, upstream.status, data);
      return;
    }
    throw new HttpError(502, '上游没有按流式格式返回，请检查 Base URL 是否兼容 Chat Completions。');
  }

  res.writeHead(200, securityHeaders({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
    Connection: 'keep-alive',
  }));
  res.flushHeaders?.();

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(Buffer.from(value))) {
        await new Promise((resolve) => {
          const done = () => {
            res.off('drain', done);
            res.off('close', done);
            resolve();
          };
          res.once('drain', done);
          res.once('close', done);
        });
      }
    }
  } catch (err) {
    if (!controller.signal.aborted && !res.writableEnded) {
      const note = { error: { message: '上游连接中断，回答可能不完整。' } };
      res.write(`data: ${JSON.stringify(note)}\n\n`);
    }
  } finally {
    if (!res.writableEnded) res.end();
    res.off('close', onClose);
  }
}

async function handleModels(req, res) {
  const key = getApiKey(req);
  const payload = await readJson(req);
  const base = normalizeBase(payload.baseUrl);

  let upstream;
  try {
    upstream = await fetch(`${apiRoot(base)}/models`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new HttpError(502, '连不上 API 服务，请检查网络或 Base URL。');
  }

  const data = await readUpstreamJson(upstream);
  sendJson(res, upstream.status, data);
}

async function handleBalance(req, res) {
  const key = getApiKey(req);
  const payload = await readJson(req);
  const base = normalizeBase(payload.baseUrl);

  let upstream;
  try {
    upstream = await fetch(`${apiRoot(base)}/user/balance`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new HttpError(502, '连不上 API 服务，请检查网络或 Base URL。');
  }

  const data = await readUpstreamJson(upstream);
  sendJson(res, upstream.status, data);
}

async function handleFiles(req, res) {
  const key = getApiKey(req);
  const base = baseFromQuery(req);
  const contentType = String(req.headers['content-type'] || '');

  if (!/^multipart\/form-data;/i.test(contentType)) {
    throw new HttpError(400, '文件上传必须使用 multipart/form-data。');
  }

  const length = Number(req.headers['content-length'] || 0);
  if (length > 100 * 1024 * 1024) throw new HttpError(413, '文件超过 100 MiB。');

  let upstream;
  try {
    upstream = await fetch(fileEndpoint(base), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': contentType,
        ...(length ? { 'Content-Length': String(length) } : {}),
      },
      body: Readable.toWeb(req),
      duplex: 'half',
      signal: AbortSignal.timeout(180000),
    });
  } catch {
    throw new HttpError(502, '文件上传失败，请检查网络或 Base URL。');
  }

  const data = await readUpstreamJson(upstream);
  sendJson(res, upstream.status, data);
}

async function handleASR(req, res) {
  const key = getApiKey(req);
  const base = baseFromQuery(req);
  const buffer = await readBuffer(req, 8 * 1024 * 1024);

  if (!buffer.length) throw new HttpError(400, '没有收到音频。');

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'audio/wav' }), 'speech.wav');

  let upstream;
  try {
    upstream = await fetch(toolEndpoint(base, 'asr'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(180000),
    });
  } catch {
    throw new HttpError(502, '语音识别失败，请检查网络或 Base URL。');
  }

  const data = await readUpstreamJson(upstream);
  sendJson(res, upstream.status, data);
}

async function handleTTS(req, res) {
  const key = getApiKey(req);
  const payload = await readJson(req);
  const base = normalizeBase(payload.baseUrl);
  const text = String(payload.text || '');
  const voiceId = payload.voiceId === 'tide' ? 'tide' : 'stella';

  if (!text.trim()) throw new HttpError(400, '没有可朗读的文本。');
  if (text.length > 10000) throw new HttpError(400, '文本超过 10,000 字符。');

  let upstream;
  try {
    upstream = await fetch(toolEndpoint(base, 'tts'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice_id: voiceId,
        format: 'wav',
        filter_markdown: true,
      }),
      signal: AbortSignal.timeout(180000),
    });
  } catch {
    throw new HttpError(502, '语音合成失败，请检查网络或 Base URL。');
  }

  if (!upstream.ok) {
    const data = await readUpstreamJson(upstream);
    sendJson(res, upstream.status, data);
    return;
  }

  if (!upstream.body) throw new HttpError(502, '语音服务没有返回音频。');

  res.writeHead(200, securityHeaders({
    'Content-Type': upstream.headers.get('content-type') || 'audio/wav',
    'Cache-Control': 'no-store',
  }));

  const stream = Readable.fromWeb(upstream.body);
  stream.on('error', () => {
    if (!res.writableEnded) res.destroy();
  });
  stream.pipe(res);
}

async function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    throw new HttpError(405, '不支持的请求方法。');
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    throw new HttpError(400, '路径不合法。');
  }

  if (pathname === '/') pathname = '/index.html';
  const relative = pathname.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, relative);

  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    throw new HttpError(403, '禁止访问。');
  }

  let info;
  try {
    info = await stat(filePath);
  } catch {
    throw new HttpError(404, '页面不存在。');
  }
  if (!info.isFile()) throw new HttpError(404, '页面不存在。');

  const ext = path.extname(filePath).toLowerCase();
  const headers = securityHeaders({
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': 'no-cache',
  });

  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on('error', () => {
    if (!res.writableEnded) res.destroy();
  });
  stream.pipe(res);
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  let pathname = '/';

  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
    assertLocalRequest(req);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 400;
    const message = err instanceof HttpError ? err.message : '请求路径不合法。';
    sendJson(res, status, { error: { message } });
    return;
  }

  res.on('finish', () => {
    // 只记录路径与状态，不记录请求体、Key 或对话内容。
    console.log(`${req.method} ${pathname} ${res.statusCode} ${Date.now() - started}ms`);
  });

  try {
    if (pathname === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, app: 'whalechat', version: VERSION });
      return;
    }
    if (pathname === '/api/chat' && req.method === 'POST') {
      await handleChat(req, res);
      return;
    }
    if (pathname === '/api/models' && req.method === 'POST') {
      await handleModels(req, res);
      return;
    }
    if (pathname === '/api/balance' && req.method === 'POST') {
      await handleBalance(req, res);
      return;
    }
    if (pathname === '/api/files' && req.method === 'POST') {
      await handleFiles(req, res);
      return;
    }
    if (pathname === '/api/asr' && req.method === 'POST') {
      await handleASR(req, res);
      return;
    }
    if (pathname === '/api/tts' && req.method === 'POST') {
      await handleTTS(req, res);
      return;
    }
    if (pathname.startsWith('/api/')) {
      throw new HttpError(404, '接口不存在。');
    }
    await serveStatic(req, res);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (!(err instanceof HttpError)) console.error(err);
    if (!res.headersSent) {
      sendJson(res, status, { error: { message: err.message || '服务器内部错误。' } });
    } else if (!res.writableEnded) {
      res.end();
    }
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n端口 ${PORT} 已被占用。`);
    console.error('可能 D&M 已经在运行，或别的程序占用了这个端口。');
    console.error(`可以设置环境变量 PORT 换一个端口，例如：PORT=3211 node server.mjs\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  D&M');
  console.log(`  http://${HOST}:${PORT}`);
  console.log('  只监听本机，Ctrl+C 退出');
  console.log('');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1200).unref();
  });
}
