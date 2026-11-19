/**
 * 开发用的假 API，仅用于检查流式转发与界面排版。
 * 运行：node tools/mock-api.mjs
 * 然后在鲸聊设置里把 Base URL 填成 http://127.0.0.1:3999/v1
 */

import http from 'node:http';

const PORT = 3999;
const HOST = '127.0.0.1';

const content = `这是用于检查排版的示例回答。

## 一个小标题

鲸聊把 **流式输出**、*思考过程* 和 Markdown 放在同一屏里。你可以按 \`Ctrl K\` 开新对话。

- 第一项：普通列表
- 第二项：带一点代码
  - 嵌套项支持两级缩进
- 第三项：结束

> 引用块用来放提示或出处。

| 能力 | 状态 |
| :--- | ---: |
| 流式对话 | 已实现 |
| 联网搜索 | 已接入 |
| 子会话 | 已接入 |

\`\`\`js
const answer = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'x-api-key': 'sk-local' },
});
console.log(answer.status);
\`\`\`

最后一行是普通段落，用来检查 [链接样式](https://api-docs.deepseek.com/zh-cn/) 和长文本换行。`;

const webContent = `根据检索结果，DeepSeek V4.1 主要更新了长上下文、工具调用与语音能力。

- 联网搜索、阅读链接和文件输入现在都整合进了对话 API。
- 服务端工具由模型自行决定是否调用，客户端只负责展示结果。
- 引用会以来源列表的形式附在回答后面。

这是一段用于检查联网轨迹、来源卡片和引用列表的示例回答。`;

const reasoning = `用户想检查界面排版。
先确认流式分块、Markdown 渲染和 token 统计都能显示。
再给一个包含标题、列表、表格、代码块和链接的样例。`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function makeWav() {
  const sampleRate = 16000;
  const seconds = 0.5;
  const samples = Math.floor(sampleRate * seconds);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index += 1) {
    buffer.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 5000), 44 + index * 2);
  }
  return buffer;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname.endsWith('/models')) {
    if (!req.headers.authorization) return send(res, 401, { error: { message: 'missing key' } });
    return send(res, 200, {
      object: 'list',
      data: [
        { id: 'deepseek-flash', object: 'model' },
        { id: 'deepseek-v4-pro', object: 'model' },
        { id: 'mock-reasoner', object: 'model' },
      ],
    });
  }

  if (req.method === 'POST' && url.pathname === '/files') {
    if (!req.headers.authorization) return send(res, 401, { error: { message: 'missing key' } });
    for await (const _chunk of req) { /* drain */ }
    return send(res, 200, {
      id: 'file-mock-1',
      object: 'file',
      bytes: 1024,
      created_at: Math.floor(Date.now() / 1000),
      filename: 'mock-document.pdf',
      purpose: 'text_recognition',
    });
  }

  if (req.method === 'POST' && url.pathname === '/v1/tools/asr') {
    if (!req.headers.authorization) return send(res, 401, { error: { message: 'missing key' } });
    for await (const _chunk of req) { /* drain */ }
    return send(res, 200, { request_id: 'mock-asr', text: '这是测试语音转出来的文字。', duration_ms: 1200 });
  }

  if (req.method === 'POST' && url.pathname === '/v1/tools/tts') {
    if (!req.headers.authorization) return send(res, 401, { error: { message: 'missing key' } });
    for await (const _chunk of req) { /* drain */ }
    const audio = makeWav();
    res.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Content-Length': audio.length,
      'Cache-Control': 'no-store',
    });
    res.end(audio);
    return;
  }

  if (req.method === 'POST' && url.pathname.endsWith('/chat/completions')) {
    if (!req.headers.authorization) return send(res, 401, { error: { message: 'missing key' } });

    let raw = '';
    for await (const chunk of req) raw += chunk;
    let body = {};
    try {
      body = JSON.parse(raw);
    } catch {
      return send(res, 400, { error: { message: 'bad json' } });
    }

    const useWeb = Array.isArray(body.tools) && body.tools.length > 0;
    const answer = useWeb ? webContent : content;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    const emit = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

    emit({
      id: 'mock-1',
      object: 'chat.completion.chunk',
      model: body.model || 'deepseek-flash',
      choices: [{ index: 0, delta: { role: 'assistant', reasoning_content: '' }, finish_reason: null }],
    });

    for (const piece of reasoning.match(/.{1,8}/gs) || []) {
      emit({
        id: 'mock-1',
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: { reasoning_content: piece }, finish_reason: null }],
      });
      await wait(18);
    }

    if (useWeb) {
      const searchCall = {
        id: 'call-search-1',
        type: 'deepseek_web_search',
        kind: 'search',
        action: { action: 'search', queries: ['DeepSeek V4.1 更新', 'DeepSeek 全家桶 API'] },
      };
      const readCall = {
        id: 'call-read-1',
        type: 'deepseek_read_url',
        kind: 'read_link',
        action: { action: 'read_link', url: 'https://api-docs.deepseek.com/zh-cn/news/news261113/' },
      };

      emit({
        id: 'mock-1',
        object: 'chat.completion.chunk',
        choices: [{
          index: 0,
          delta: {},
          server_tool_event: { type: 'call_started', step: 0, call: searchCall },
          finish_reason: null,
        }],
      });
      await wait(160);
      emit({
        id: 'mock-1',
        object: 'chat.completion.chunk',
        choices: [{
          index: 0,
          delta: {},
          server_tool_event: {
            type: 'call_completed',
            step: 0,
            call: searchCall,
            status: 'success',
            sources: [
              {
                title: 'DeepSeek 发布全家桶应用 API',
                url: 'https://api-docs.deepseek.com/zh-cn/news/news261113/',
                site_name: 'DeepSeek API Docs',
                snippet: '联网搜索、文件输入、阅读链接、模型安全、ASR、TTS 等能力整合进对话 API。',
              },
              {
                title: '构建 Chatbot 指南',
                url: 'https://api-docs.deepseek.com/zh-cn/guides/build_a_chatbot',
                site_name: 'DeepSeek API Docs',
                snippet: '搜索和阅读链接都由服务端完成，客户端只需要展示返回的内容块。',
              },
            ],
          },
          finish_reason: null,
        }],
      });
      await wait(160);
      emit({
        id: 'mock-1',
        object: 'chat.completion.chunk',
        choices: [{
          index: 0,
          delta: {},
          server_tool_event: { type: 'call_started', step: 1, call: readCall },
          finish_reason: null,
        }],
      });
      await wait(160);
      emit({
        id: 'mock-1',
        object: 'chat.completion.chunk',
        choices: [{
          index: 0,
          delta: {},
          server_tool_event: {
            type: 'call_completed',
            step: 1,
            call: readCall,
            status: 'success',
            page: {
              url: 'https://api-docs.deepseek.com/zh-cn/news/news261113/',
              title: 'DeepSeek 发布全家桶应用 API',
              published_at: '2026-11-13',
            },
          },
          finish_reason: null,
        }],
      });
      await wait(120);
    }

    for (const piece of answer.match(/.{1,7}/gs) || []) {
      emit({
        id: 'mock-1',
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: { content: piece }, finish_reason: null }],
      });
      await wait(16);
    }

    const finalDelta = {};
    if (useWeb) {
      finalDelta.server_tool_calls = [
        {
          index: 0,
          reasoning_content: '',
          calls: [
            { index: 0, id: 'call-search-1', type: 'deepseek_web_search', kind: 'search', action: { action: 'search', queries: ['DeepSeek V4.1 更新'] } },
            { index: 1, id: 'call-read-1', type: 'deepseek_read_url', kind: 'read_link', action: { action: 'read_link', url: 'https://api-docs.deepseek.com/zh-cn/news/news261113/' } },
          ],
        },
      ];
      finalDelta.annotations = [
        {
          type: 'url_citation',
          url_citation: {
            url: 'https://api-docs.deepseek.com/zh-cn/news/news261113/',
            title: 'DeepSeek 发布全家桶应用 API',
            start_index: 0,
            end_index: 18,
          },
        },
      ];
    }

    emit({
      id: 'mock-1',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: finalDelta, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: 128,
        completion_tokens: 512,
        total_tokens: 640,
        completion_tokens_details: { reasoning_tokens: 96 },
        server_tool_use: useWeb ? { tool_search: 1, tool_fetch: 1 } : undefined,
      },
    });
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  send(res, 404, { error: { message: 'not found' } });
});

server.listen(PORT, HOST, () => {
  console.log(`mock api on http://${HOST}:${PORT}/v1`);
});
