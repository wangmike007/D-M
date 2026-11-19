(() => {
  if (!/DMAndroid/i.test(navigator.userAgent) && location.protocol !== 'file:') return;

  const nativeFetch = window.fetch.bind(window);
  const SETTINGS_KEY = 'whalechat.v1.settings';

  function settings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }

  function normalizeBase(raw) {
    const value = String(raw || settings().baseUrl || 'https://api.deepseek.com').trim();
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Base URL 不合法。');
    if (url.protocol === 'http:' && !['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
      throw new Error('远程 Base URL 必须使用 HTTPS。');
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

  function cleanContent(content) {
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

  function cleanMessages(raw) {
    if (!Array.isArray(raw)) return [];
    const messages = [];
    for (const message of raw) {
      if (!message || !['system', 'user', 'assistant'].includes(message.role)) continue;
      const content = cleanContent(message.content);
      if (content === null) continue;
      if (typeof content === 'string' && !content) continue;
      if (Array.isArray(content) && content.length === 0) continue;
      const clean = { role: message.role, content };
      if (message.role === 'assistant') {
        if (typeof message.reasoning_content === 'string' && message.reasoning_content) {
          clean.reasoning_content = message.reasoning_content;
        }
        if (Array.isArray(message.server_tool_calls)) clean.server_tool_calls = message.server_tool_calls;
      }
      messages.push(clean);
    }
    return messages;
  }

  async function readJsonBody(init) {
    if (!init || init.body == null) return {};
    if (typeof init.body === 'string') return JSON.parse(init.body);
    throw new Error('请求体格式不支持。');
  }

  function errorResponse(message, status = 400) {
    return new Response(JSON.stringify({ error: { message } }), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  async function route(input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!url.pathname.startsWith('/api/')) return nativeFetch(input, init);

    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    let key = headers.get('x-api-key') || settings().apiKey || '';
    key = key.replace(/^Bearer\s+/i, '').trim();
    if (!key) return errorResponse('缺少 API Key，请先在设置里填写。', 401);
    headers.delete('x-api-key');
    headers.set('Authorization', `Bearer ${key}`);

    const baseFromQuery = url.searchParams.get('baseUrl');
    const path = url.pathname;

    if (path === '/api/chat') {
      const payload = await readJsonBody(init);
      const base = normalizeBase(payload.baseUrl);
      const messages = cleanMessages(payload.messages);
      if (!messages.length) return errorResponse('没有可发送的消息。');
      const body = {
        model: payload.model,
        messages,
        stream: true,
      };
      if (['none', 'low', 'high', 'max'].includes(payload.thinkingLevel)) {
        body.reasoning_effort = payload.thinkingLevel;
      } else if (typeof payload.thinking === 'boolean') {
        body.reasoning_effort = payload.thinking ? 'high' : 'none';
      }
      if (payload.webSearch === true && /deepseek-flash/i.test(payload.model)) {
        body.tools = [{ type: 'deepseek_web_search' }, { type: 'deepseek_read_url' }];
      }
      if (Number.isFinite(payload.maxTokens)) {
        body.max_tokens = Math.max(1, Math.min(393216, Math.floor(payload.maxTokens)));
      }
      headers.set('Content-Type', 'application/json');
      headers.set('Accept', 'text/event-stream');
      return nativeFetch(`${apiRoot(base)}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: init.signal,
      });
    }

    if (path === '/api/models') {
      const payload = await readJsonBody(init);
      const base = normalizeBase(payload.baseUrl);
      headers.set('Accept', 'application/json');
      return nativeFetch(`${apiRoot(base)}/models`, { headers, signal: init.signal });
    }

    if (path === '/api/balance') {
      const payload = await readJsonBody(init);
      const base = normalizeBase(payload.baseUrl);
      headers.set('Accept', 'application/json');
      return nativeFetch(`${apiRoot(base)}/user/balance`, { headers, signal: init.signal });
    }

    if (path === '/api/files') {
      const base = normalizeBase(baseFromQuery);
      return nativeFetch(`${apiOrigin(base)}/files`, {
        method: 'POST',
        headers,
        body: init.body,
        signal: init.signal,
      });
    }

    if (path === '/api/asr') {
      const base = normalizeBase(baseFromQuery);
      const raw = init.body;
      const blob = raw instanceof Blob ? raw : new Blob([raw], { type: 'audio/wav' });
      const form = new FormData();
      form.append('file', blob, 'speech.wav');
      headers.delete('Content-Type');
      return nativeFetch(`${apiOrigin(base)}/v1/tools/asr`, {
        method: 'POST',
        headers,
        body: form,
        signal: init.signal,
      });
    }

    if (path === '/api/tts') {
      const payload = await readJsonBody(init);
      const base = normalizeBase(payload.baseUrl);
      headers.set('Content-Type', 'application/json');
      return nativeFetch(`${apiOrigin(base)}/v1/tools/tts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: String(payload.text || ''),
          voice_id: payload.voiceId === 'tide' ? 'tide' : 'stella',
          format: 'wav',
          filter_markdown: true,
        }),
        signal: init.signal,
      });
    }

    return errorResponse('不支持的移动端接口。', 404);
  }

  window.fetch = (input, init) => route(input, init).catch((error) => (
    errorResponse(error instanceof Error ? error.message : '网络请求失败。', 502)
  ));
})();
