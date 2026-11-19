import { renderMarkdown } from './markdown.js';
import { DEFAULT_SYSTEM_PROMPTS, EMPTY_TITLES } from './prompts.js';

/* ==========================================================================
   D&M · 前端逻辑
   所有数据只存在本机 localStorage；API Key 只在请求头里经过本机代理。
   ========================================================================== */

const STORAGE = {
  settings: 'whalechat.v1.settings',
  conversations: 'whalechat.v1.conversations',
  active: 'whalechat.v1.active',
  outlineCollapsed: 'whalechat.v1.outlineCollapsed',
};

const DEFAULTS = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-flash',
  systemPrompt: '',
  thinkingLevel: 'high',
  theme: 'light',
  sidebarView: 'cards',
  ttsVoice: 'stella',
  fontSizePx: 15,
  fontFamily: 'sans',
  chatWidthPx: 820,
  sidebarCollapsed: false,
  outlineRailCollapsed: false,
  remoteModels: [],
};

const mql = window.matchMedia('(prefers-color-scheme: dark)');
const $ = (selector, root = document) => root.querySelector(selector);

const dom = {
  app: $('#app'),
  sidebar: $('#sidebar'),
  scrim: $('#scrim'),
  openSidebar: $('#openSidebar'),
  closeSidebar: $('#closeSidebar'),
  newChat: $('#newChat'),
  newChatTop: $('#newChatTop'),
  searchToggleTop: $('#searchToggleTop'),
  convSearch: $('#convSearch'),
  convSearchClear: $('#convSearchClear'),
  searchResults: $('#searchResults'),
  navLabel: $('#navLabel'),
  convList: $('#convList'),
  convEmpty: $('#convEmpty'),
  keyState: $('#keyState'),
  keyStateText: $('#keyStateText'),
  keyDot: $('#keyDot'),
  keySetup: $('#keySetup'),
  balanceState: $('#balanceState'),
  balanceDot: $('#balanceDot'),
  balanceValue: $('#balanceValue'),
  openSettingsTop: $('#openSettingsTop'),
  themeToggle: $('#themeToggle'),
  fontSizeRange: $('#fontSizeRange'),
  fontSizeValue: $('#fontSizeValue'),
  fontFamilyChoice: $('#fontFamilyChoice'),
  turnRail: $('#turnRail'),
  turnRailTrack: $('#turnRailTrack'),
  chatSonar: $('#chatSonar'),
  widthDrag: $('#widthDrag'),
  dropOverlay: $('#dropOverlay'),
  main: $('.main'),
  topbar: $('.topbar'),
  composerWrap: $('.composer-wrap'),
  title: $('#convTitle'),
  meta: $('#convMeta'),
  modelSelect: $('#modelSelect'),
  modelDot: $('#modelDot'),
  app: $('.app'),
  chat: $('#chatScroll'),
  emptyState: $('#emptyState'),
  emptyTitle: $('#emptyTitle'),
  threadContext: $('#threadContext'),
  threadContextEyebrow: $('#threadContextEyebrow'),
  threadContextTitle: $('#threadContextTitle'),
  threadContextQuote: $('#threadContextQuote'),
  threadContextBack: $('#threadContextBack'),
  threadContextClose: $('#threadContextClose'),
  outlineToggle: $('#outlineToggle'),
  threadOutline: $('#threadOutline'),
  outlineTree: $('#outlineTree'),
  outlineClose: $('#outlineClose'),
  outlineScrim: $('#outlineScrim'),
  messages: $('#messages'),
  scrollBottom: $('#scrollBottom'),
  composer: $('#composer'),
  input: $('#input'),
  fileInput: $('#fileInput'),
  cameraInput: $('#cameraInput'),
  fileChips: $('#fileChips'),
  attachBtn: $('#attachBtn'),
  cameraBtn: $('#cameraBtn'),
  webToggle: $('#webToggle'),
  micBtn: $('#micBtn'),
  recordingBar: $('#recordingBar'),
  recordingTime: $('#recordingTime'),
  stopRecording: $('#stopRecording'),
  cancelRecording: $('#cancelRecording'),
  sendBtn: $('#sendBtn'),
  stopBtn: $('#stopBtn'),
  thinkingLevel: $('#thinkingLevel'),
  thinkingToggle: $('#thinkingToggle'),
  thinkingState: $('#thinkingState'),
  selectionBar: $('#selectionBar'),
  selectionText: $('#selectionText'),
  selectionOpen: $('#selectionOpen'),
  selectionClear: $('#selectionClear'),
  settingsModal: $('#settingsModal'),
  setKey: $('#setKey'),
  toggleKey: $('#toggleKey'),
  setBase: $('#setBase'),
  setModel: $('#setModel'),
  modelOptions: $('#modelOptions'),
  setSystem: $('#setSystem'),
  setThinkingLevel: $('#setThinkingLevel'),
  setVoice: $('#setVoice'),
  exportAll: $('#exportAll'),
  importAll: $('#importAll'),
  importFile: $('#importFile'),
  testConn: $('#testConn'),
  testResult: $('#testResult'),
  themeChoice: $('#themeChoice'),
  saveSettings: $('#saveSettings'),
  toastRoot: $('#toastRoot'),
};

function loadSettings() {
  let loaded = {};
  try {
    loaded = JSON.parse(localStorage.getItem(STORAGE.settings) || '{}') || {};
  } catch {
    loaded = {};
  }
  return {
    ...DEFAULTS,
    ...loaded,
    apiKey: typeof loaded.apiKey === 'string' ? loaded.apiKey : '',
    baseUrl: typeof loaded.baseUrl === 'string' && loaded.baseUrl ? loaded.baseUrl : DEFAULTS.baseUrl,
    model: typeof loaded.model === 'string' && loaded.model ? loaded.model : DEFAULTS.model,
    systemPrompt: typeof loaded.systemPrompt === 'string' ? loaded.systemPrompt : '',
    thinkingLevel: ['none', 'low', 'high', 'max'].includes(loaded.thinkingLevel)
      ? loaded.thinkingLevel
      : loaded.defaultThinking === false ? 'none' : DEFAULTS.thinkingLevel,
    theme: loaded.theme === 'dark' ? 'dark' : 'light',
    sidebarView: ['cards', 'list'].includes(loaded.sidebarView) ? loaded.sidebarView : DEFAULTS.sidebarView,
    ttsVoice: ['stella', 'tide'].includes(loaded.ttsVoice) ? loaded.ttsVoice : DEFAULTS.ttsVoice,
    fontSizePx: Number.isFinite(Number(loaded.fontSizePx))
      ? Math.max(10, Math.min(32, Number(loaded.fontSizePx)))
      : ({ small: 14, normal: 15, large: 16.5, xlarge: 18 }[loaded.fontSize] || DEFAULTS.fontSizePx),
    fontFamily: loaded.fontFamily === 'serif' ? 'serif' : DEFAULTS.fontFamily,
    chatWidthPx: Number.isFinite(Number(loaded.chatWidthPx))
      ? Math.max(480, Math.min(4000, Number(loaded.chatWidthPx)))
      : ({ standard: 820, wide: 1100, full: 1600 }[loaded.chatWidth] || DEFAULTS.chatWidthPx),
    sidebarCollapsed: loaded.sidebarCollapsed === true,
    outlineRailCollapsed: loaded.outlineRailCollapsed === true,
    remoteModels: Array.isArray(loaded.remoteModels) ? loaded.remoteModels.filter((x) => typeof x === 'string') : [],
  };
}

function loadOutlineCollapsed() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE.outlineCollapsed) || '[]');
    return new Set(Array.isArray(raw) ? raw.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function persistOutlineCollapsed() {
  try {
    localStorage.setItem(STORAGE.outlineCollapsed, JSON.stringify([...state.outlineCollapsed]));
  } catch {
    // ignore quota / private browsing
  }
}

function loadConversations() {
  let loaded = [];
  try {
    loaded = JSON.parse(localStorage.getItem(STORAGE.conversations) || '[]');
  } catch {
    loaded = [];
  }
  if (!Array.isArray(loaded)) return [];

  return loaded
    .filter((conversation) => conversation && typeof conversation.id === 'string')
    .map((conversation) => ({
      id: conversation.id,
      title: typeof conversation.title === 'string' && conversation.title.trim() ? conversation.title : '新对话',
      createdAt: typeof conversation.createdAt === 'string' ? conversation.createdAt : new Date().toISOString(),
      updatedAt: typeof conversation.updatedAt === 'string' ? conversation.updatedAt : new Date().toISOString(),
      thinkingLevel: ['none', 'low', 'high', 'max'].includes(conversation.thinkingLevel)
        ? conversation.thinkingLevel
        : conversation.thinking === false ? 'none' : 'high',
      pinned: Boolean(conversation.pinned),
      archived: false,
      parentId: typeof conversation.parentId === 'string' ? conversation.parentId : null,
      anchorMessageId: typeof conversation.anchorMessageId === 'string' ? conversation.anchorMessageId : '',
      anchorText: typeof conversation.anchorText === 'string' ? conversation.anchorText : '',
      anchorLabel: typeof conversation.anchorLabel === 'string' ? conversation.anchorLabel : '',
      anchorContext: typeof conversation.anchorContext === 'string' ? conversation.anchorContext : '',
      webSearch: Boolean(conversation.webSearch),
      pendingFiles: Array.isArray(conversation.pendingFiles)
        ? conversation.pendingFiles.filter((file) => file && typeof file.id === 'string')
        : [],
      messages: Array.isArray(conversation.messages)
        ? conversation.messages
            .filter((message) => message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string')
            .map((message) => ({
              id: typeof message.id === 'string' ? message.id : uid(),
              role: message.role,
              content: message.content,
              reasoning: typeof message.reasoning === 'string' ? message.reasoning : '',
              model: typeof message.model === 'string' ? message.model : '',
              createdAt: typeof message.createdAt === 'string' ? message.createdAt : new Date().toISOString(),
              durationMs: Number.isFinite(message.durationMs) ? message.durationMs : 0,
              error: typeof message.error === 'string' ? message.error : '',
              stopped: Boolean(message.stopped),
              usage: message.usage && typeof message.usage === 'object' ? message.usage : null,
              files: Array.isArray(message.files)
                ? message.files.filter((file) => file && typeof file.id === 'string')
                : [],
              serverToolCalls: Array.isArray(message.serverToolCalls) ? message.serverToolCalls : null,
              annotations: Array.isArray(message.annotations) ? message.annotations : [],
              toolEvents: Array.isArray(message.toolEvents) ? message.toolEvents : [],
            }))
            .filter((message) => message.role === 'user' || message.content || message.reasoning || message.error || message.stopped)
        : [],
    }))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

const state = {
  settings: loadSettings(),
  conversations: loadConversations(),
  activeId: localStorage.getItem(STORAGE.active) || '',
  remoteModels: [],
  generating: false,
  streamingId: '',
  abort: null,
  stick: true,
  composing: false,
  paintFrame: 0,
  modalTheme: 'system',
  modalFontSizePx: 15,
  modalFontFamily: 'sans',
  modalChatWidthPx: 820,
  widthDrag: null,
  lastFocus: null,
  searchQuery: '',
  selection: null,
  selectionFrame: 0,
  ttsMessageId: '',
  ttsAudio: null,
  audioRecorder: null,
  lastThinkingLevel: 'high',
  outlineCollapsed: loadOutlineCollapsed(),
  balance: { status: 'idle', text: '—', title: '点击刷新 API 余额' },
  balancePending: false,
};

state.remoteModels = [...state.settings.remoteModels];

/* ---------- 小工具 ---------- */

function uid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function truncate(value, length) {
  const text = String(value ?? '');
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function externalUrl(value) {
  try {
    const url = new URL(String(value), window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function formatClock(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatRelative(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))} 分钟前`;
  if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))} 小时前`;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return '昨天';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 1000) return '<1 秒';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

function formatTokens(value) {
  const number = Number(value || 0);
  if (number < 1000) return String(number);
  if (number < 10_000) return `${(number / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${Math.round(number / 1000)}k`;
}

function makeTitle(text) {
  const cleaned = String(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#>*_`~[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '新对话';
  const chars = Array.from(cleaned);
  return chars.length > 26 ? `${chars.slice(0, 26).join('')}…` : cleaned;
}

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

function toast(message, duration = 2800) {
  const element = document.createElement('div');
  element.className = 'toast';
  element.textContent = message;
  dom.toastRoot.append(element);
  window.setTimeout(() => element.remove(), duration);
}

/* ---------- 持久化 ---------- */

function persistSettings() {
  state.settings.remoteModels = [...state.remoteModels];
  try {
    localStorage.setItem(STORAGE.settings, JSON.stringify(state.settings));
  } catch {
    toast('浏览器本地存储写入失败，设置可能无法保留。');
  }
}

function persistConversations() {
  try {
    localStorage.setItem(STORAGE.conversations, JSON.stringify(state.conversations));
  } catch {
    toast('本地存储已满。可以删除一些旧对话，或缩短对话历史。');
  }
}

function persistActive() {
  try {
    localStorage.setItem(STORAGE.active, state.activeId);
  } catch {
    // 忽略即可
  }
}

/* ---------- 主题 ---------- */

function resolvedTheme(preference) {
  return preference === 'dark' ? 'dark' : 'light';
}

function defaultSystemPrompt() {
  return DEFAULT_SYSTEM_PROMPTS[resolvedTheme(state.settings.theme)] || '';
}

function updateEmptyTitle(dark) {
  if (!dom.emptyTitle) return;
  dom.emptyTitle.textContent = dark ? EMPTY_TITLES.dark : EMPTY_TITLES.light;
  dom.emptyTitle.classList.toggle('is-whale-title', dark);
  dom.emptyTitle.classList.toggle('is-moss-title', !dark);
}

function syncThemeAssets(dark) {
  const favicon = document.getElementById('appFavicon');
  if (favicon) favicon.setAttribute('href', dark ? './favicon-dark.svg?v=dm2' : './favicon-light.svg?v=dm2');
  try { window.DMNative?.setTheme(dark ? 'dark' : 'light'); } catch {}
  try { window.DMDesktop?.setTheme(dark ? 'dark' : 'light'); } catch {}
}

function paintTheme(preference) {
  const dark = resolvedTheme(preference) === 'dark';
  document.documentElement.dataset.theme = 'construct';
  document.documentElement.dataset.scheme = dark ? 'dark' : 'light';
  updateEmptyTitle(dark);
  syncThemeAssets(dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#07101D' : '#E9DFC8');
  syncMossVisibility();
  requestAnimationFrame(syncChatBounds);
}

function syncThemeChoice() {
  dom.themeChoice.querySelectorAll('[data-theme-choice]').forEach((button) => {
    button.setAttribute('aria-checked', String(button.dataset.themeChoice === state.modalTheme));
  });
}

function paintReading(fontSizePx, fontFamily) {
  const size = Math.max(10, Math.min(32, Number(fontSizePx) || 15));
  const family = fontFamily === 'serif' ? 'serif' : 'sans';
  document.documentElement.style.setProperty('--read-size', `${size}px`);
  document.documentElement.dataset.readFont = family;
}

function syncFontChoices() {
  dom.fontFamilyChoice.querySelectorAll('[data-font-family]').forEach((button) => {
    button.setAttribute('aria-checked', String(button.dataset.fontFamily === state.modalFontFamily));
  });
}

function syncFontSizeSetting() {
  if (!dom.fontSizeRange) return;
  dom.fontSizeRange.value = String(state.modalFontSizePx);
  dom.fontSizeValue.textContent = `${Number(state.modalFontSizePx).toFixed(1).replace(/\.0$/, '')}px`;
}

function applyModalFontSize(px) {
  const size = Math.max(10, Math.min(32, Number(px) || 15));
  state.modalFontSizePx = size;
  paintReading(size, state.modalFontFamily);
  syncFontSizeSetting();
}

function chooseModalFontFamily(family) {
  if (family !== 'sans' && family !== 'serif') return;
  state.modalFontFamily = family;
  paintReading(state.modalFontSizePx, state.modalFontFamily);
  syncFontChoices();
}

function paintChatWidth(widthPx) {
  const width = Math.max(480, Math.min(4000, Number(widthPx) || 820));
  document.documentElement.style.setProperty('--chat-max', `${width}px`);
  requestAnimationFrame(positionWidthGrip);
}

function syncChatBounds() {
  const topbar = dom.topbar?.getBoundingClientRect().height || 64;
  const composer = dom.composerWrap?.getBoundingClientRect().height || 140;
  document.documentElement.style.setProperty('--topbar-h', `${Math.round(topbar)}px`);
  document.documentElement.style.setProperty('--composer-h', `${Math.round(composer)}px`);
}

function currentChatWidth() {
  return document.querySelector('.chat-inner')?.getBoundingClientRect().width || state.settings.chatWidthPx;
}

function maxChatWidth() {
  const gutter = window.matchMedia('(max-width: 880px)').matches ? 48 : 148;
  return Math.max(480, Math.floor(dom.chat.getBoundingClientRect().width - gutter));
}

function syncChatWidthSetting() {
  // Width is controlled by the drag bar above the composer now.
}

function applyModalChatWidth(widthPx) {
  const value = Math.max(480, Math.min(4000, Number(widthPx) || 820));
  state.modalChatWidthPx = value;
  paintChatWidth(value);
  syncChatWidthSetting();
}

function positionWidthGrip() {
  if (!dom.widthDrag) return;
  dom.widthDrag.setAttribute('aria-valuemin', '480');
  dom.widthDrag.setAttribute('aria-valuemax', String(maxChatWidth()));
  dom.widthDrag.setAttribute('aria-valuenow', String(Math.round(state.settings.chatWidthPx)));
}

function setChatWidth(widthPx, persist = false) {
  const width = Math.max(480, Math.min(maxChatWidth(), Number(widthPx) || 820));
  state.settings.chatWidthPx = width;
  paintChatWidth(width);
  if (persist) persistSettings();
}

function startWidthDrag(event) {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  state.widthDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startWidth: currentChatWidth(),
  };
  dom.widthDrag.setPointerCapture?.(event.pointerId);
  dom.app.classList.add('resizing-width');
}

function moveWidthDrag(event) {
  const drag = state.widthDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  // The left edge is fixed; dragging the bar right widens the chat.
  const next = drag.startWidth + (event.clientX - drag.startX);
  setChatWidth(next, false);
}

function endWidthDrag(event) {
  if (!state.widthDrag) return;
  if (event?.pointerId !== undefined && event.pointerId !== state.widthDrag.pointerId) return;
  state.widthDrag = null;
  dom.app.classList.remove('resizing-width');
  setChatWidth(currentChatWidth(), true);
}

mql.addEventListener('change', () => {
  if (state.settings.theme === 'system') paintTheme('system');
});

/* ---------- 当前对话 ---------- */

function currentConversation() {
  return state.conversations.find((conversation) => conversation.id === state.activeId) || null;
}

function sortedConversations() {
  return [...state.conversations]
    .filter((conversation) => !conversation.parentId)
    .sort((a, b) => {
      const pinDelta = Number(b.pinned) - Number(a.pinned);
      if (pinDelta !== 0) return pinDelta;
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });
}

const MAX_THREAD_DEPTH = 6;

function childrenOf(parentId) {
  return state.conversations
    .filter((conversation) => conversation.parentId === parentId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function parentOf(conversation) {
  if (!conversation?.parentId) return null;
  return state.conversations.find((item) => item.id === conversation.parentId) || null;
}

function threadPath(conversation = currentConversation()) {
  const path = [];
  const seen = new Set();
  let node = conversation;
  while (node && !seen.has(node.id)) {
    path.unshift(node);
    seen.add(node.id);
    node = parentOf(node);
  }
  return path;
}

function rootConversation(conversation = currentConversation()) {
  const path = threadPath(conversation);
  return path[0] || null;
}

function depthOf(conversation = currentConversation()) {
  return Math.max(0, threadPath(conversation).length - 1);
}

function descendantsOf(id) {
  const output = [];
  const seen = new Set([id]);
  const stack = [...childrenOf(id)];
  while (stack.length) {
    const node = stack.shift();
    if (!node || seen.has(node.id)) continue;
    seen.add(node.id);
    output.push(node);
    stack.push(...childrenOf(node.id));
  }
  return output;
}

function subtreeIds(id) {
  return [id, ...descendantsOf(id).map((conversation) => conversation.id)];
}

function descendantCount(id) {
  return descendantsOf(id).length;
}

function createConversation({ persist = true } = {}) {
  const conversation = {
    id: uid(),
    title: '新对话',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    thinkingLevel: state.settings.thinkingLevel,
    pinned: false,
    archived: false,
    parentId: null,
    anchorMessageId: '',
    anchorText: '',
    anchorContext: '',
    webSearch: false,
    pendingFiles: [],
    messages: [],
  };
  state.conversations.unshift(conversation);
  state.activeId = conversation.id;
  if (persist) {
    persistConversations();
    persistActive();
  }
  return conversation;
}

function ensureActiveConversation() {
  const active = currentConversation();
  if (active) return;

  const first = sortedConversations()[0];
  if (first) {
    state.activeId = first.id;
    persistActive();
  } else {
    createConversation();
  }
}

/* ---------- 目录渲染 ---------- */

function renderModelOptions() {
  const models = [...new Set([
    'deepseek-flash',
    'deepseek-v4-pro',
    state.settings.model,
    ...state.remoteModels,
  ].filter(Boolean))];

  dom.modelSelect.replaceChildren();
  dom.modelOptions.replaceChildren();

  for (const id of models) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = id;
    dom.modelSelect.append(option);

    const dataOption = document.createElement('option');
    dataOption.value = id;
    if (id === 'deepseek-flash') dataOption.label = 'DeepSeek V4.1 Flash';
    if (id === 'deepseek-v4-pro') dataOption.label = 'DeepSeek V4 Pro';
    dom.modelOptions.append(dataOption);
  }

  dom.modelSelect.value = state.settings.model;
}

function conversationSnippet(conversation) {
  const last = [...conversation.messages].reverse().find((message) => message.content && !message.error);
  if (!last) return '还没有消息';

  const text = String(last.content)
    .replace(/```[\s\S]*?```/g, ' [代码] ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[#>*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return last.role === 'user' ? '你发了一条消息' : '已回答';
  return `${last.role === 'user' ? '你：' : ''}${truncate(text, 64)}`;
}

function conversationModel(conversation) {
  const lastAssistant = [...conversation.messages].reverse().find((message) => message.role === 'assistant' && message.model);
  return lastAssistant?.model || state.settings.model;
}

function cardAction(iconName, label, onClick, extraClass = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `card-action ${extraClass}`.trim();
  button.title = label;
  button.setAttribute('aria-label', label);
  button.append(icon(iconName));

  const text = document.createElement('span');
  text.className = 'card-action-label';
  text.textContent = label;
  button.append(text);

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick(button);
  });
  return button;
}

function createConversationCard(conversation, index) {
  const card = document.createElement('article');
  card.className = 'conv-card';
  if (rootConversation()?.id === conversation.id) card.classList.add('active');
  if (conversation.pinned) card.classList.add('pinned');
  card.dataset.id = conversation.id;

  const childCount = descendantCount(conversation.id);

  const tab = document.createElement('div');
  tab.className = 'card-tab';

  const idx = document.createElement('span');
  idx.className = 'card-idx';
  idx.textContent = String(index + 1).padStart(2, '0');
  if (conversation.pinned) idx.append(icon('pin'));
  if (childCount > 0) idx.append(icon('branch'));

  const time = document.createElement('span');
  time.className = 'card-time';
  time.textContent = formatRelative(conversation.updatedAt);

  const menuButton = document.createElement('button');
  menuButton.type = 'button';
  menuButton.className = 'card-menu-toggle';
  menuButton.textContent = '⋯';
  menuButton.title = '更多操作';
  menuButton.setAttribute('aria-label', '更多操作');
  menuButton.setAttribute('aria-haspopup', 'menu');
  menuButton.setAttribute('aria-expanded', 'false');

  tab.append(idx, time, menuButton);

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'card-open';
  open.title = conversation.title;
  open.setAttribute('aria-label', `打开对话：${conversation.title}`);
  if (rootConversation()?.id === conversation.id) open.setAttribute('aria-current', 'true');

  const title = document.createElement('span');
  title.className = 'card-title';
  title.textContent = conversation.title;

  const snippet = document.createElement('span');
  snippet.className = 'card-snippet';
  snippet.textContent = conversationSnippet(conversation);

  open.append(title, snippet);

  card.addEventListener('click', (event) => {
    if (event.target.closest('.card-action, .card-menu, .card-menu-toggle')) return;
    switchConversation(conversation.id);
  });

  const foot = document.createElement('div');
  foot.className = 'card-foot';

  const meta = document.createElement('span');
  meta.className = 'card-meta';
  const baseMeta = conversation.messages.length
    ? `${conversation.messages.length} 条 · ${conversationModel(conversation)}`
    : '尚未开始';
  meta.textContent = childCount > 0 ? `${baseMeta} · ${childCount} 子` : baseMeta;

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const pin = cardAction('pin', conversation.pinned ? '取消置顶' : '置顶', () => togglePin(conversation));
  if (conversation.pinned) pin.classList.add('is-on');

  actions.append(
    pin,
    cardAction('edit', '重命名', () => renameConversation(conversation)),
    cardAction('download', '导出', () => exportConversations([conversation], '对话')),
    cardAction('trash', '删除', (button) => {
      handleDeleteConversation(conversation, button);
    }, 'danger'),
  );

  foot.append(meta);

  const menu = document.createElement('div');
  menu.className = 'card-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  menu.append(actions);

  menuButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = menu.hidden;
    closeAllCardMenus();
    menu.hidden = !willOpen;
    menuButton.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) actions.querySelector('.card-action')?.focus();
  });

  card.append(tab, open, foot, menu);
  return card;
}

function closeAllCardMenus() {
  document.querySelectorAll('.conv-card .card-menu').forEach((menu) => {
    menu.hidden = true;
    const button = menu.closest('.conv-card')?.querySelector('.card-menu-toggle');
    button?.setAttribute('aria-expanded', 'false');
  });
}

function createConversationRow(conversation) {
  const item = document.createElement('div');
  item.className = 'conv-item';
  if (rootConversation()?.id === conversation.id) item.classList.add('active');
  if (conversation.pinned) item.classList.add('pinned');

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'conv-open';
  open.title = conversation.title;

  const title = document.createElement('span');
  title.className = 'conv-title';
  title.textContent = conversation.title;

  const time = document.createElement('span');
  time.className = 'conv-time';
  time.textContent = formatRelative(conversation.updatedAt);

  open.append(title, time);
  open.addEventListener('click', () => switchConversation(conversation.id));

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'conv-del';
  remove.title = '删除对话';
  remove.setAttribute('aria-label', `删除对话：${conversation.title}`);
  remove.append(icon('trash'));
  remove.addEventListener('click', (event) => {
    event.stopPropagation();
    handleDeleteConversation(conversation, remove);
  });

  item.append(open, remove);
  return item;
}

function conversationSearchText(conversation) {
  return [
    conversation.title,
    conversation.anchorLabel,
    ...(conversation.messages || []).map((message) => message.content || ''),
    ...(conversation.messages || []).flatMap((message) => (message.files || []).map((file) => file.filename || '')),
  ].join('\n').toLowerCase();
}

function searchSnippet(conversation, query) {
  const lower = query.toLowerCase();
  const messages = conversation.messages || [];
  const matching = messages.find((message) => String(message.content || '').toLowerCase().includes(lower));
  const text = matching?.content
    || [...messages].reverse().find((message) => message.content)?.content
    || (conversation.messages.flatMap((message) => message.files || []).map((file) => file.filename).join('、'))
    || '没有消息';
  return truncate(String(text).replace(/\s+/g, ' ').trim(), 64);
}

function renderSearchResults(query) {
  const lower = query.toLowerCase();
  const results = state.conversations
    .filter((conversation) => conversationSearchText(conversation).includes(lower))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 40);

  dom.searchResults.replaceChildren();
  if (!results.length) {
    const empty = document.createElement('p');
    empty.className = 'search-empty';
    empty.textContent = '没有匹配的对话';
    dom.searchResults.append(empty);
    return;
  }

  for (const conversation of results) {
    const path = threadPath(conversation);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'search-result';
    row.classList.toggle('active', conversation.id === state.activeId);
    row.title = conversation.title;

    const title = document.createElement('span');
    title.className = 'search-result-title';
    title.textContent = conversation.title;

    const meta = document.createElement('span');
    meta.className = 'search-result-meta';
    meta.textContent = path.length > 1
      ? `子会话 · ${path.slice(0, -1).map((item) => item.title).join(' / ')}`
      : '主会话';

    const snippet = document.createElement('span');
    snippet.className = 'search-result-snippet';
    snippet.textContent = searchSnippet(conversation, query);

    row.append(title, meta, snippet);
    row.addEventListener('click', () => {
      state.searchQuery = '';
      dom.convSearch.value = '';
      switchConversation(conversation.id);
    });
    dom.searchResults.append(row);
  }
}

function renderConversations() {
  const query = state.searchQuery.trim();
  dom.convSearchClear.hidden = !query;

  if (query) {
    dom.navLabel.textContent = '搜索结果';
    dom.convList.hidden = true;
    dom.searchResults.hidden = false;
    dom.convEmpty.hidden = true;
    renderSearchResults(query);
    return;
  }

  dom.convList.hidden = false;
  dom.searchResults.hidden = true;
  const conversations = sortedConversations();

  dom.convList.className = 'conv-list view-merged';
  dom.navLabel.textContent = '对话';

  dom.convList.replaceChildren();
  conversations.forEach((conversation, index) => {
    dom.convList.append(createConversationCard(conversation, index));
  });

  dom.convEmpty.hidden = conversations.length > 0;
  dom.convEmpty.textContent = '还没有对话';
}

function togglePin(conversation) {
  conversation.pinned = !conversation.pinned;
  persistConversations();
  renderConversations();
}

function safeExportName(value) {
  return String(value || '对话').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 48) || '对话';
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function saveExportFile(filename, text) {
  try {
    if (window.DMNative?.saveFile) {
      if (window.DMNative.saveFile(filename, toBase64(text))) {
        toast('已导出到手机的下载目录。');
        return;
      }
    }
  } catch {
    // Fall through to a normal browser download.
  }
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('对话已导出。');
}

function exportConversations(list, scope = '全部对话') {
  const conversations = list.filter(Boolean);
  if (!conversations.length) {
    toast('没有可导出的对话。');
    return;
  }
  const payload = {
    format: 'dm.conversations',
    version: 1,
    app: 'D&M',
    exportedAt: nowIso(),
    conversations,
  };
  const title = conversations.length === 1 ? conversations[0].title : scope;
  const stamp = new Date().toISOString().slice(0, 10);
  saveExportFile(`D&M-${safeExportName(title)}-${stamp}.json`, JSON.stringify(payload, null, 2));
}

function importMessage(raw) {
  if (!raw || !['user', 'assistant'].includes(raw.role)) return null;
  const content = typeof raw.content === 'string' ? raw.content : '';
  if (!content && !Array.isArray(raw.files)) return null;
  return {
    id: uid(),
    role: raw.role,
    content,
    model: typeof raw.model === 'string' ? raw.model : '',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowIso(),
    reasoning: typeof raw.reasoning === 'string' ? raw.reasoning : '',
    durationMs: Number.isFinite(raw.durationMs) ? raw.durationMs : 0,
    error: typeof raw.error === 'string' ? raw.error : '',
    stopped: Boolean(raw.stopped),
    usage: raw.usage ?? null,
    files: Array.isArray(raw.files) ? raw.files.filter((file) => file && typeof file.id === 'string') : [],
    serverToolCalls: Array.isArray(raw.serverToolCalls) ? raw.serverToolCalls : null,
    annotations: Array.isArray(raw.annotations) ? raw.annotations : [],
    toolEvents: Array.isArray(raw.toolEvents) ? raw.toolEvents : [],
  };
}

function importConversations(raw) {
  const source = Array.isArray(raw) ? raw : (Array.isArray(raw?.conversations) ? raw.conversations : []);
  if (!source.length) throw new Error('文件里没有对话。');
  const idMap = new Map();
  const imported = [];

  for (let index = 0; index < source.length; index += 1) {
    const item = source[index];
    if (!item || typeof item !== 'object') continue;
    const oldId = String(item.id || '');
    const messages = Array.isArray(item.messages)
      ? item.messages.map(importMessage).filter(Boolean)
      : [];
    const nextId = uid();
    if (oldId) idMap.set(oldId, nextId);
    imported.push({
      id: nextId,
      title: typeof item.title === 'string' && item.title.trim() ? item.title.trim().slice(0, 120) : '导入的对话',
      pinned: Boolean(item.pinned),
      archived: false,
      parentId: null,
      anchorMessageId: '',
      anchorText: typeof item.anchorText === 'string' ? item.anchorText : '',
      anchorLabel: typeof item.anchorLabel === 'string' ? item.anchorLabel : '',
      anchorContext: typeof item.anchorContext === 'string' ? item.anchorContext : '',
      thinkingLevel: ['none', 'low', 'high', 'max'].includes(item.thinkingLevel) ? item.thinkingLevel : 'high',
      webSearch: false,
      pendingFiles: [],
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : nowIso(),
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : nowIso(),
      messages,
      sourceId: oldId,
    });
  }

  for (let i = 0; i < imported.length; i += 1) {
    const oldParent = String(imported[i].sourceId ? (source.find((item) => String(item?.id || '') === imported[i].sourceId)?.parentId || '') : '');
    if (oldParent && idMap.has(oldParent)) imported[i].parentId = idMap.get(oldParent);
    delete imported[i].sourceId;
  }

  if (!imported.length) throw new Error('文件里没有可用对话。');
  state.conversations.push(...imported);
  state.activeId = imported[0].id;
  persistConversations();
  persistActive();
  renderAll();
  closeSettings();
  toast(`已导入 ${imported.length} 个对话。`);
}

function renameConversation(conversation) {
  const next = window.prompt('重命名对话', conversation.title);
  if (next === null) return;
  const title = next.trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!title || title === conversation.title) return;
  conversation.title = title;
  persistConversations();
  renderConversations();
  renderHeader();
  toast('已重命名。');
}

function renderHeader() {
  const conversation = currentConversation();
  const title = conversation?.title || '新对话';
  const parent = parentOf(conversation);
  const depth = depthOf(conversation);
  dom.title.textContent = title;
  document.title = title === '新对话' ? 'D&M' : `${title} · D&M`;

  if (parent) {
    dom.meta.textContent = state.generating
      ? `正在回答 · ${state.settings.model} · 第 ${depth} 层`
      : `第 ${depth} 层子会话`;
  } else if (state.generating) {
    dom.meta.textContent = `正在回答 · ${state.settings.model}`;
  } else if (conversation && conversation.messages.length > 0) {
    dom.meta.textContent = `${conversation.messages.length} 条消息 · ${state.settings.model}`;
  } else {
    dom.meta.textContent = '尚未开始';
  }

  dom.modelSelect.value = state.settings.model;
  if (!state.generating) dom.input.placeholder = defaultPlaceholder();
}

function closeOutlineDrawer() {
  dom.app.classList.remove('outline-open');
  dom.outlineScrim.hidden = true;
}

function openOutlineDrawer() {
  if (dom.threadOutline.hidden) return;
  dom.app.classList.add('outline-open');
  dom.outlineScrim.hidden = false;
}

function toggleOutlineCollapse(node) {
  const children = childrenOf(node.id);
  if (!children.length) return;

  const collapsing = !state.outlineCollapsed.has(node.id);
  if (collapsing) {
    const active = currentConversation();
    const activeInside = active && active.id !== node.id
      && threadPath(active).some((item) => item.id === node.id);
    if (activeInside) {
      if (state.generating) {
        toast('先停止回答，再收起当前分支。');
        return;
      }
      stopTTS();
      clearSelectionBar(true);
      state.activeId = node.id;
      persistActive();
    }
    state.outlineCollapsed.add(node.id);
  } else {
    state.outlineCollapsed.delete(node.id);
  }

  persistOutlineCollapsed();
  renderAll();
}

function handleOutlineDelete(node, button) {
  const count = descendantCount(node.id);
  if (button.dataset.confirm === '1') {
    deleteThread(node.id);
    return;
  }

  button.dataset.confirm = '1';
  button.classList.add('confirm');
  button.title = count > 0 ? `再点一次，删除整支（含 ${count} 个下级）` : '再点一次，删除这个子会话';
  toast(count > 0 ? `再点一次，会连同 ${count} 个下级一起删除。` : '再点一次，删除这个子会话。', 2400);
  window.clearTimeout(button._timer);
  button._timer = window.setTimeout(() => {
    button.dataset.confirm = '';
    button.classList.remove('confirm');
    button.title = count > 0 ? `删除这一支（含 ${count} 个下级）` : '删除这个子会话';
  }, 2600);
}

function renderThreadOutline() {
  requestAnimationFrame(positionWidthGrip);
  const conversation = currentConversation();
  const path = threadPath(conversation);
  const root = path[0];
  const hasTree = Boolean(root && (path.length > 1 || descendantCount(root.id) > 0));
  const narrow = window.matchMedia('(max-width: 1100px)').matches;
  const railCollapsed = !narrow && state.settings.outlineRailCollapsed === true;

  if (!hasTree) {
    dom.threadOutline.hidden = true;
    dom.outlineToggle.hidden = true;
    dom.app.classList.remove('has-outline');
    closeOutlineDrawer();
    return;
  }

  dom.outlineToggle.hidden = false;
  dom.outlineToggle.title = narrow ? '线程层级' : railCollapsed ? '展开线程层级' : '收起线程层级';
  dom.outlineToggle.setAttribute('aria-label', dom.outlineToggle.title);
  dom.outlineClose.title = narrow ? '关闭线程层级' : '收起线程层级';

  if (railCollapsed) {
    dom.threadOutline.hidden = true;
    dom.app.classList.remove('has-outline');
    closeOutlineDrawer();
    return;
  }

  // Keep the active path visible even if an old collapsed id was persisted.
  let expandedPath = false;
  for (const ancestor of path.slice(0, -1)) {
    if (state.outlineCollapsed.delete(ancestor.id)) expandedPath = true;
  }
  if (expandedPath) persistOutlineCollapsed();

  dom.threadOutline.hidden = false;
  dom.outlineToggle.hidden = false;
  dom.app.classList.add('has-outline');
  dom.outlineTree.replaceChildren();

  const renderNode = (node, depth) => {
    const children = childrenOf(node.id);
    const collapsed = children.length > 0 && state.outlineCollapsed.has(node.id);

    const row = document.createElement('div');
    row.className = `outline-node depth-${Math.min(depth, 5)}`;
    row.classList.toggle('active', node.id === conversation?.id);
    row.classList.toggle('collapsed', collapsed);

    const caret = document.createElement('button');
    caret.type = 'button';
    caret.className = 'outline-caret';

    if (children.length) {
      caret.setAttribute('aria-expanded', String(!collapsed));
      caret.setAttribute('aria-label', collapsed ? '展开分支' : '收起分支');
      caret.title = collapsed ? '展开分支' : '收起分支';
      caret.append(icon('chevron'));
      caret.addEventListener('click', () => toggleOutlineCollapse(node));
    } else {
      caret.disabled = true;
      caret.tabIndex = -1;
      caret.classList.add('leaf');
    }

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'outline-main';
    main.title = node.title;

    const level = document.createElement('span');
    level.className = 'outline-level';
    level.textContent = `L${depth}`;

    const title = document.createElement('span');
    title.className = 'outline-title';
    title.textContent = depth === 0 ? `主会话 · ${node.title}` : node.title;

    main.append(level, title);

    if (collapsed) {
      const count = document.createElement('span');
      count.className = 'outline-count';
      count.textContent = `+${descendantCount(node.id)}`;
      main.append(count);
    }

    main.addEventListener('click', () => switchConversation(node.id));
    row.append(caret, main);

    if (depth > 0) {
      const count = descendantCount(node.id);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'outline-delete';
      remove.title = count > 0 ? `删除这一支（含 ${count} 个下级）` : '删除这个子会话';
      remove.setAttribute('aria-label', remove.title);
      remove.append(icon('trash'));
      remove.addEventListener('click', () => handleOutlineDelete(node, remove));
      row.append(remove);
    }

    dom.outlineTree.append(row);

    if (!collapsed) {
      for (const child of children) renderNode(child, depth + 1);
    }
  };

  renderNode(root, 0);
}

function renderThreadContext() {
  const conversation = currentConversation();
  const parent = parentOf(conversation);
  if (!parent) {
    dom.threadContext.hidden = true;
    return;
  }

  const depth = depthOf(conversation);
  const childCount = descendantCount(conversation.id);
  window.clearTimeout(dom.threadContextClose._timer);
  dom.threadContextClose.dataset.confirm = '';
  dom.threadContextClose.classList.remove('confirm');
  dom.threadContextClose.textContent = childCount > 0 ? `删除本支 · ${childCount}` : '删除子会话';
  dom.threadContextClose.title = childCount > 0
    ? `删除这一支，连同 ${childCount} 个下级`
    : '删除这个子会话';
  dom.threadContext.hidden = false;
  dom.threadContextEyebrow.textContent = `SUB THREAD · 第 ${depth} 层`;
  dom.threadContextTitle.textContent = `关于「${truncate(conversation.anchorLabel || conversation.anchorText || '这段内容', 28)}」`;
  dom.threadContextQuote.textContent = truncate(conversation.anchorContext || '上级片段未保存。', 900);
  dom.threadContextBack.textContent = depth > 1 ? '返回上级' : '返回主会话';
}

function createChildConversation(anchorMessage, anchorText, explicit = false) {
  const parent = currentConversation();
  if (!parent) return;

  if (state.generating) {
    toast('先停止当前回答，再开子会话。');
    return;
  }

  const parentDepth = depthOf(parent);
  if (parentDepth >= MAX_THREAD_DEPTH) {
    toast(`子会话最多 ${MAX_THREAD_DEPTH} 层。`);
    return;
  }

  const rawText = String(anchorText || '').trim() || truncate(anchorMessage.content, 80) || '这段内容';
  const focusText = truncate(rawText, 200);
  const label = explicit
    ? truncate(focusText, 28)
    : (anchorMessage.role === 'assistant' ? '这段回答' : '这条消息');
  const title = explicit
    ? (focusText.length <= 28 ? `关于「${focusText}」` : `子会话 · ${truncate(focusText, 14)}`)
    : `子会话 · 第 ${parentDepth + 1} 层`;
  const child = {
    id: uid(),
    title,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    thinkingLevel: parent.thinkingLevel || 'high',
    pinned: false,
    archived: false,
    parentId: parent.id,
    anchorMessageId: anchorMessage.id,
    anchorText: focusText,
    anchorLabel: label,
    anchorContext: truncate(anchorMessage.content, 1800),
    webSearch: Boolean(parent.webSearch),
    pendingFiles: [],
    messages: [],
  };

  state.conversations.push(child);
  state.activeId = child.id;
  persistConversations();
  persistActive();
  clearSelectionBar(true);
  closeOutlineDrawer();
  renderAll();
  dom.input.focus();
}

function selectedTextForMessage(messageId) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return '';
  const text = selection.toString().trim();
  if (!text || text.length > 200) return '';

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const element = container.nodeType === 1 ? container : container.parentElement;
  const messageElement = element?.closest('.msg');
  if (!messageElement || messageElement.dataset.id !== messageId) return '';
  return truncate(text, 200);
}

function clearSelectionBar(clearNative = false) {
  state.selection = null;
  dom.selectionBar.hidden = true;
  if (clearNative) window.getSelection()?.removeAllRanges();
}

function handleSelectionChange() {
  if (state.selectionFrame) return;
  state.selectionFrame = requestAnimationFrame(() => {
    state.selectionFrame = 0;
    const conversation = currentConversation();
    if (!conversation) {
      clearSelectionBar();
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      clearSelectionBar();
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length > 200) {
      clearSelectionBar();
      return;
    }

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === 1 ? container : container.parentElement;
    const messageElement = element?.closest('.msg');
    if (!messageElement || !dom.messages.contains(messageElement)) {
      clearSelectionBar();
      return;
    }

    state.selection = {
      text,
      messageId: messageElement.dataset.id,
      conversationId: conversation.id,
    };
    dom.selectionText.textContent = truncate(text, 24);
    dom.selectionBar.hidden = false;
  });
}

function openChildThread(messageId, text) {
  const conversation = currentConversation();
  if (!conversation) return;
  const message = conversation.messages.find((item) => item.id === messageId);
  if (!message) return;
  const explicit = Boolean(text && text.trim());
  const anchor = explicit
    ? text.trim()
    : (truncate(message.content, 80) || (message.files?.length ? '这份文件' : ''));
  if (!anchor) return;
  createChildConversation(message, anchor, explicit);
}

function deleteThread(id) {
  if (state.generating) {
    toast('先停止当前回答，再关闭子会话。');
    return;
  }

  const child = state.conversations.find((conversation) => conversation.id === id);
  if (!child?.parentId) return;

  const parentId = child.parentId;
  const ids = new Set(subtreeIds(id));
  const activeAffected = ids.has(state.activeId);
  if (activeAffected) stopTTS();
  state.conversations = state.conversations.filter((conversation) => !ids.has(conversation.id));
  if (activeAffected) state.activeId = parentId;

  persistConversations();
  persistActive();
  closeOutlineDrawer();
  renderAll();
  toast(ids.size > 1 ? `已删除子会话及 ${ids.size - 1} 个下级。` : '已删除子会话。', 2200);
}

function renderKeyState() {
  const hasKey = Boolean(state.settings.apiKey.trim());
  dom.keyDot.classList.toggle('ok', hasKey);
  dom.keyStateText.textContent = hasKey ? 'Key 已配置' : '未配置 API Key';
  dom.keyState.title = hasKey
    ? 'Key 只保存在本机浏览器；在右上角设置里管理'
    : '在右上角设置里配置 API Key';
  dom.keySetup.hidden = hasKey;
  dom.modelDot.classList.toggle('off', !hasKey);
  renderBalance();
}

function balanceMoney(info) {
  const currency = String(info?.currency || '').toUpperCase();
  const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : currency ? `${currency} ` : '';
  const raw = String(info?.total_balance ?? info?.balance ?? '').trim();
  const amount = Number(raw);
  return `${symbol}${Number.isFinite(amount) ? amount.toFixed(2) : raw || '—'}`;
}

function renderBalance() {
  if (!dom.balanceState) return;
  const hasKey = Boolean(state.settings.apiKey.trim());
  dom.balanceState.hidden = !hasKey;
  if (!hasKey) return;
  const balance = state.balance;
  dom.balanceState.classList.toggle('is-loading', balance.status === 'loading');
  dom.balanceState.classList.toggle('is-error', balance.status === 'error');
  dom.balanceValue.textContent = balance.text || '—';
  dom.balanceState.title = balance.title || '点击刷新 API 余额';
  dom.balanceValue.setAttribute('aria-label', `API 余额 ${balance.text || '未知'}`);
}

async function refreshBalance({ silent = false } = {}) {
  const key = state.settings.apiKey.trim();
  if (!key) {
    state.balance = { status: 'idle', text: '—', title: '点击刷新 API 余额' };
    renderBalance();
    return;
  }
  if (state.balancePending) return;

  state.balancePending = true;
  state.balance = { status: 'loading', text: '查询中…', title: '正在查询 API 余额' };
  renderBalance();

  try {
    const response = await fetch('/api/balance', {
      method: 'POST',
      headers: { 'x-api-key': key },
      body: JSON.stringify({ baseUrl: state.settings.baseUrl }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(errorMessage(data, response.status) || `HTTP ${response.status}`);
    const infos = Array.isArray(data?.balance_infos) ? data.balance_infos : [];
    if (!infos.length) throw new Error('接口没有返回余额');
    const text = infos.slice(0, 2).map(balanceMoney).join(' / ')
      + (infos.length > 2 ? ` +${infos.length - 2}` : '');
    const detail = infos.map((info) => {
      const currency = String(info.currency || '').toUpperCase() || '余额';
      return `${currency}：总额 ${info.total_balance ?? '—'}，赠金 ${info.granted_balance ?? '—'}，充值 ${info.topped_up_balance ?? '—'}`;
    }).join('\n');
    state.balance = {
      status: data.is_available === false ? 'error' : 'ok',
      text: data.is_available === false ? `${text}（不可用）` : text,
      title: `API 余额（点击刷新）\n${detail}`,
    };
  } catch (error) {
    state.balance = {
      status: 'error',
      text: '余额不可用',
      title: `API 余额查询失败：${error.message}\n点击重试`,
    };
    if (!silent) toast(`余额查询失败：${error.message}`, 2600);
  } finally {
    state.balancePending = false;
    renderBalance();
  }
}

function supportsThinking() {
  return /deepseek/i.test(state.settings.model);
}

function supportsWebTools() {
  return /deepseek-flash/i.test(state.settings.model);
}

function renderThinkingToggle() {
  const conversation = currentConversation();
  const supported = supportsThinking();
  const level = ['low', 'high', 'max'].includes(conversation?.thinkingLevel)
    ? conversation.thinkingLevel
    : conversation?.thinkingLevel === 'none' ? 'none' : 'high';
  if (level !== 'none') state.lastThinkingLevel = level;
  const enabled = supported && level !== 'none';
  const shownLevel = level === 'none' ? (state.lastThinkingLevel || 'high') : level;

  dom.thinkingLevel.value = shownLevel;
  dom.thinkingLevel.disabled = state.generating || !supported || !enabled;
  dom.thinkingToggle.disabled = state.generating || !supported;
  dom.thinkingToggle.setAttribute('aria-pressed', String(enabled));
  dom.thinkingToggle.classList.toggle('is-on', enabled);
  dom.thinkingToggle.title = supported
    ? `是否思考：${enabled ? '开' : '关'}（点一下${enabled ? '关闭' : '打开'}）`
    : '当前模型不支持思考参数';
  dom.thinkingState.textContent = enabled ? '开' : '关';

  const levelControl = dom.thinkingLevel.closest('.thinking-level-control');
  if (levelControl) {
    levelControl.classList.toggle('is-on', enabled);
    levelControl.title = supported
      ? enabled ? `思考等级：${{ low: '低', high: '高', max: '最高' }[shownLevel]}` : '先打开思考'
      : '当前模型不支持思考参数';
  }
}

function renderWebToggle() {
  const conversation = currentConversation();
  const supported = supportsWebTools();
  const enabled = Boolean(conversation && conversation.webSearch);
  dom.webToggle.disabled = state.generating || !supported;
  dom.webToggle.setAttribute('aria-pressed', String(supported && enabled));
  dom.webToggle.title = supported
    ? '联网搜索 / 阅读链接（DeepSeek）'
    : '当前模型不支持 DeepSeek 联网工具';
}

/* ---------- 消息渲染 ---------- */

function createMessageNode(message, animate = true) {
  const article = document.createElement('article');
  article.className = `msg msg-${message.role}`;
  if (!animate) article.classList.add('no-anim');
  article.dataset.id = message.id;

  const head = document.createElement('div');
  head.className = 'msg-head';

  const who = document.createElement('span');
  who.className = 'msg-who';
  who.textContent = message.role === 'user' ? '你' : 'D&M';
  head.append(who);

  if (message.role === 'assistant' && message.model) {
    const model = document.createElement('span');
    model.className = 'msg-model';
    model.textContent = message.model;
    head.append(model);
  }

  const time = document.createElement('time');
  time.className = 'msg-time';
  time.dateTime = message.createdAt;
  time.textContent = formatClock(message.createdAt);
  time.title = new Date(message.createdAt).toLocaleString('zh-CN');
  head.append(time);
  article.append(head);

  if (message.role === 'user') {
    const card = document.createElement('div');
    card.className = 'user-card';
    if (message.content) {
      const text = document.createElement('div');
      text.className = 'user-text';
      text.textContent = message.content;
      card.append(text);
    }
    if (message.files?.length) {
      const files = document.createElement('div');
      files.className = 'message-files';
      for (const file of message.files) {
        const chip = document.createElement('span');
        chip.className = 'message-file';
        if (file.thumb) {
          const image = document.createElement('img');
          image.className = 'message-file-thumb';
          image.src = file.thumb;
          image.alt = '';
          chip.append(image);
        } else {
          chip.append(icon('file'));
        }
        const name = document.createElement('span');
        name.textContent = file.filename || '文件';
        chip.append(name);
        files.append(chip);
      }
      card.append(files);
    }
    article.append(card);

    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    article.append(actions);
    article._refs = { actions };
  } else {
    const body = document.createElement('div');
    body.className = 'msg-body';

    const toolTrace = document.createElement('details');
    toolTrace.className = 'tool-trace';
    toolTrace.hidden = true;
    const toolSummary = document.createElement('summary');
    const toolLabel = document.createElement('span');
    toolLabel.className = 'tool-label';
    toolLabel.textContent = '联网检索';
    toolSummary.append(toolLabel);
    const toolCalls = document.createElement('div');
    toolCalls.className = 'tool-calls';
    toolTrace.append(toolSummary, toolCalls);
    toolSummary.addEventListener('click', () => {
      toolTrace.dataset.touched = '1';
    });

    const details = document.createElement('details');
    details.className = 'reasoning';
    details.hidden = true;

    const summary = document.createElement('summary');
    const reasonLabel = document.createElement('span');
    reasonLabel.className = 'reason-label';
    reasonLabel.textContent = '思考过程';
    const reasonDuration = document.createElement('span');
    reasonDuration.className = 'reason-duration';
    summary.append(reasonLabel, reasonDuration);
    summary.addEventListener('click', () => {
      details.dataset.touched = '1';
    });

    const reasonText = document.createElement('div');
    reasonText.className = 'reason-text';
    details.append(summary, reasonText);

    const markdown = document.createElement('div');
    markdown.className = 'md';

    const thinking = document.createElement('div');
    thinking.className = 'thinking';
    thinking.hidden = true;
    const orb = document.createElement('span');
    orb.className = 'thinking-orb';
    const thinkingText = document.createElement('span');
    thinkingText.textContent = '思考中…';
    thinking.append(orb, thinkingText);

    const error = document.createElement('div');
    error.className = 'msg-error';
    error.hidden = true;

    const citations = document.createElement('div');
    citations.className = 'citations';
    citations.hidden = true;

    body.append(toolTrace, details, markdown, thinking, error, citations);
    article.append(body);

    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    article.append(actions);

    article._refs = {
      actions,
      toolTrace,
      toolSummary,
      toolLabel,
      toolCalls,
      details,
      reasonLabel,
      reasonDuration,
      reasonText,
      markdown,
      thinking,
      error,
      citations,
    };
  }

  paintMessage(article, message);
  return article;
}

function appendMessageNode(message) {
  const node = createMessageNode(message, true);
  dom.messages.append(node);
  syncMossVisibility();
  if (message.role === 'user') renderTurnRail();
  return node;
}

function turnPreview(message) {
  const text = String(message.content || '').replace(/\s+/g, ' ').trim();
  if (text) return truncate(text, 42);
  if (message.files?.length) return `附件：${truncate(message.files[0].filename || '文件', 28)}`;
  return '（无文字）';
}

function renderTurnRail() {
  const conversation = currentConversation();
  const users = (conversation?.messages || []).filter((message) => message.role === 'user');
  dom.turnRailTrack.replaceChildren();

  if (users.length < 2) {
    dom.turnRail.hidden = true;
    return;
  }

  users.forEach((message, index) => {
    const tick = document.createElement('button');
    tick.type = 'button';
    tick.className = 'turn-tick';
    tick.dataset.messageId = message.id;
    const preview = turnPreview(message);
    tick.title = `第 ${index + 1} 轮：${preview}`;
    tick.setAttribute('aria-label', tick.title);
    tick.addEventListener('click', () => {
      const node = [...dom.messages.querySelectorAll('.msg')]
        .find((element) => element.dataset.id === message.id);
      if (!node) return;
      const top = node.getBoundingClientRect().top
        - dom.chat.getBoundingClientRect().top
        + dom.chat.scrollTop - 16;
      state.stick = false;
      dom.chat.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      toast(`第 ${index + 1} 轮：${preview}`, 2000);
    });
    dom.turnRailTrack.append(tick);
  });

  dom.turnRail.hidden = false;
  requestAnimationFrame(updateTurnRailActive);
}

function updateTurnRailActive() {
  const ticks = [...dom.turnRailTrack.children];
  if (!ticks.length) return;

  if (nearBottom()) {
    ticks.forEach((tick, index) => {
      tick.classList.toggle('active', index === ticks.length - 1);
      tick.setAttribute('aria-current', index === ticks.length - 1 ? 'true' : 'false');
    });
    return;
  }

  const top = dom.chat.getBoundingClientRect().top + 88;
  let active = 0;

  ticks.forEach((tick, index) => {
    const node = [...dom.messages.querySelectorAll('.msg')]
      .find((element) => element.dataset.id === tick.dataset.messageId);
    if (node && node.getBoundingClientRect().top <= top) active = index;
  });

  ticks.forEach((tick, index) => {
    tick.classList.toggle('active', index === active);
    tick.setAttribute('aria-current', index === active ? 'true' : 'false');
  });
}

function findMessageNode(id) {
  return [...dom.messages.children].find((node) => node.dataset.id === id) || null;
}

function appendCaret(container) {
  const last = container.lastElementChild;
  if (!last) return;
  if (['HR', 'PRE', 'TABLE'].includes(last.tagName)) return;
  if (last.classList.contains('code-block') || last.classList.contains('table-wrap')) return;

  const target = last.querySelector('li:last-child, p:last-child, td:last-child, th:last-child') || last;
  if (target.tagName === 'PRE') return;

  const caret = document.createElement('span');
  caret.className = 'stream-caret';
  caret.setAttribute('aria-hidden', 'true');
  target.append(caret);
}

function renderToolTrace(refs, message, streaming) {
  const events = Array.isArray(message.toolEvents) ? message.toolEvents : [];
  if (!events.length) {
    refs.toolTrace.hidden = true;
    return;
  }

  refs.toolTrace.hidden = false;
  const searches = events.filter((event) => event.action?.action === 'search').length;
  const pages = events.filter((event) => ['read_link', 'open_page'].includes(event.action?.action)).length;
  const parts = [];
  if (streaming) parts.push('联网检索中…');
  if (searches) parts.push(`${searches} 次搜索`);
  if (pages) parts.push(`${pages} 个网页`);
  refs.toolLabel.textContent = parts.join(' · ') || '联网检索';

  if (!refs.toolTrace.dataset.touched) {
    refs.toolTrace.open = Boolean(streaming && !message.content);
  }

  refs.toolCalls.replaceChildren();
  for (const event of events) {
    const call = document.createElement('div');
    call.className = 'tool-call';

    const head = document.createElement('div');
    head.className = 'tool-call-head';

    const kind = document.createElement('span');
    kind.className = 'tool-call-kind';
    const action = event.action || {};
    const actionType = action.action || event.kind || 'call';
    if (actionType === 'search') kind.textContent = 'SEARCH';
    else if (actionType === 'read_link') kind.textContent = 'READ';
    else if (actionType === 'open_page') kind.textContent = 'OPEN';
    else if (actionType === 'find_in_page') kind.textContent = 'FIND';
    else kind.textContent = 'TOOL';

    const query = document.createElement('span');
    query.className = 'tool-call-query';
    if (actionAction(event) === 'search') {
      query.textContent = (action.queries || []).join(' · ') || '搜索';
    } else if (actionAction(event) === 'find_in_page') {
      query.textContent = `在页面中查找「${action.pattern || ''}」`;
    } else {
      query.textContent = action.url || event.page?.url || '打开网页';
    }

    const status = document.createElement('span');
    status.className = 'tool-call-status';
    status.textContent = event.status === 'running' ? '进行中' : event.error ? '失败' : '完成';

    head.append(kind, query, status);
    call.append(head);

    const sources = Array.isArray(event.sources) ? event.sources : [];
    if (event.page) sources.unshift(event.page);
    if (sources.length) {
      const list = document.createElement('div');
      list.className = 'tool-sources';
      for (const source of sources.slice(0, 6)) {
        if (!source || !source.url) continue;
        const href = externalUrl(source.url);
        if (!href) continue;
        const link = document.createElement('a');
        link.className = 'tool-source';
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const title = document.createElement('span');
        title.className = 'tool-source-title';
        title.textContent = source.title || source.url;
        const meta = document.createElement('span');
        meta.className = 'tool-source-meta';
        meta.textContent = source.site_name || source.url;
        link.append(title, meta);
        if (source.snippet) {
          const snippet = document.createElement('span');
          snippet.className = 'tool-source-snippet';
          snippet.textContent = source.snippet;
          link.append(snippet);
        }
        list.append(link);
      }
      call.append(list);
    }

    refs.toolCalls.append(call);
  }
}

function actionAction(event) {
  return event.action?.action || event.kind || '';
}

function renderCitations(refs, message) {
  const annotations = Array.isArray(message.annotations) ? message.annotations : [];
  const seen = new Set();
  const items = [];

  for (const annotation of annotations) {
    const citation = annotation?.url_citation || annotation;
    const url = externalUrl(citation?.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    items.push({ url, title: citation.title || url });
  }

  if (!items.length) {
    refs.citations.hidden = true;
    refs.citations.replaceChildren();
    return;
  }

  refs.citations.hidden = false;
  refs.citations.replaceChildren();
  const label = document.createElement('span');
  label.className = 'citations-label';
  label.textContent = '来源';
  const list = document.createElement('ol');
  for (const item of items.slice(0, 10)) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = item.title;
    li.append(link);
    list.append(li);
  }
  refs.citations.append(label, list);
}

function paintAssistant(node, message) {
  const refs = node._refs;
  if (!refs) return;
  const streaming = state.generating && state.streamingId === message.id;

  renderToolTrace(refs, message, streaming);

  if (message.reasoning) {
    refs.details.hidden = false;
    const shouldStick = refs.reasonText.scrollHeight - refs.reasonText.scrollTop - refs.reasonText.clientHeight < 48;
    refs.reasonText.textContent = message.reasoning;
    refs.reasonLabel.textContent = streaming && !message.content ? '思考中' : '思考过程';
    refs.reasonDuration.textContent = message.durationMs ? `· ${formatDuration(message.durationMs)}` : '';
    if (!refs.details.dataset.touched) {
      refs.details.open = Boolean(streaming && !message.content);
    }
    if (streaming && shouldStick) {
      refs.reasonText.scrollTop = refs.reasonText.scrollHeight;
    }
  } else {
    refs.details.hidden = true;
  }

  if (message.content) {
    refs.markdown.innerHTML = renderMarkdown(message.content);
    if (streaming) appendCaret(refs.markdown);
  } else {
    refs.markdown.replaceChildren();
  }

  const thinking = streaming && !message.content && !message.reasoning;
  refs.thinking.hidden = !thinking;

  if (message.error) {
    refs.error.hidden = false;
    refs.error.replaceChildren();
    const text = document.createElement('span');
    text.textContent = message.error;
    refs.error.append(text);
    if (!streaming && isLastMessage(message)) {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '重试';
      retry.addEventListener('click', regenerateLast);
      refs.error.append(retry);
    }
  } else {
    refs.error.hidden = true;
    refs.error.replaceChildren();
  }

  if (message.stopped && !message.content) {
    refs.markdown.innerHTML = '<p class="empty-reply">已停止生成。</p>';
  } else if (!message.content && !message.reasoning && !message.error && !streaming) {
    refs.markdown.innerHTML = '<p class="empty-reply">没有返回内容。</p>';
  }

  renderCitations(refs, message);
  renderActions(node, message);
}

function paintMessage(node, message) {
  if (message.role === 'assistant') {
    paintAssistant(node, message);
  } else {
    renderActions(node, message);
  }
}

function actionButton(label, iconName, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'msg-action';
  const text = document.createElement('span');
  text.textContent = label;
  button.append(icon(iconName), text);
  button.addEventListener('click', onClick);
  button._label = text;
  return button;
}

function copyAction(message) {
  const button = actionButton('复制', 'copy', async () => {
    const ok = await copyText(message.content);
    if (!ok) {
      toast('复制失败，请手动选择文本。');
      return;
    }
    button._label.textContent = '已复制';
    window.setTimeout(() => {
      button._label.textContent = '复制';
    }, 1400);
  });
  return button;
}

function renderActions(node, message) {
  const refs = node._refs;
  if (!refs?.actions) return;
  const actions = refs.actions;
  actions.replaceChildren();

  const streaming = message.role === 'assistant' && state.generating && state.streamingId === message.id;
  actions.hidden = streaming;
  if (streaming) return;

  if (message.role === 'user') {
    if (message.content) actions.append(copyAction(message));
    if (message.content || message.files?.length) {
      actions.append(actionButton('子会话', 'branch', () => {
        openChildThread(message.id, selectedTextForMessage(message.id));
      }));
    }
    return;
  }

  if (message.content) actions.append(copyAction(message));

  if (message.content) {
    const speaking = state.ttsMessageId === message.id;
    actions.append(actionButton(speaking ? '停止' : '朗读', 'speaker', () => {
      void toggleTTS(message);
    }));
  }

  if (message.content || message.files?.length) {
    actions.append(actionButton('子会话', 'branch', () => {
      openChildThread(message.id, selectedTextForMessage(message.id));
    }));
  }

  if (!message.error && isLastMessage(message) && !state.generating) {
    actions.append(actionButton('重新生成', 'refresh', regenerateLast));
  }

  if (message.stopped) {
    const note = document.createElement('span');
    note.className = 'stopped-note';
    note.textContent = '已停止';
    actions.append(note);
  }

  if (message.usage && (message.usage.prompt || message.usage.completion)) {
    const usage = document.createElement('span');
    usage.className = 'usage';
    usage.textContent = `↑ ${formatTokens(message.usage.prompt)} · ↓ ${formatTokens(message.usage.completion)}`;
    usage.title = `输入 ${message.usage.prompt || 0} tokens · 输出 ${message.usage.completion || 0} tokens`;
    actions.append(usage);
  }
}

function isLastMessage(message) {
  const conversation = currentConversation();
  const last = conversation?.messages[conversation.messages.length - 1];
  return Boolean(last && last.id === message.id);
}

function syncMossVisibility() {
  const conversation = currentConversation();
  const hasMessages = Boolean(conversation?.messages.length);
  dom.main?.classList.toggle('chat-has-messages', hasMessages);
  if (!dom.chatSonar) return;
  const lightMoss = document.documentElement.dataset.scheme === 'light';
  dom.chatSonar.hidden = !lightMoss;
}

function renderMessages() {
  const conversation = currentConversation();
  dom.messages.replaceChildren();
  renderThreadContext();

  if (!conversation || conversation.messages.length === 0) {
    dom.emptyState.hidden = Boolean(conversation?.parentId);
    dom.messages.hidden = true;
    dom.scrollBottom.hidden = true;
    dom.turnRail.hidden = true;
    dom.turnRailTrack.replaceChildren();
    syncMossVisibility();
    requestAnimationFrame(() => {
      dom.chat.scrollTop = 0;
    });
    return;
  }

  dom.emptyState.hidden = true;
  dom.messages.hidden = false;

  for (const message of conversation.messages) {
    dom.messages.append(createMessageNode(message, false));
  }

  renderTurnRail();
  syncMossVisibility();
  dom.scrollBottom.hidden = true;
  state.stick = true;
  requestAnimationFrame(() => {
    dom.chat.scrollTop = dom.chat.scrollHeight;
    updateTurnRailActive();
  });
}

function renderAll() {
  renderConversations();
  renderHeader();
  renderThreadOutline();
  renderMessages();
  renderKeyState();
  renderThinkingToggle();
  renderWebToggle();
  renderFileChips();
  requestAnimationFrame(() => {
    syncChatBounds();
    positionWidthGrip();
  });
}

/* ---------- 滚动 ---------- */

function pinBottom() {
  dom.chat.scrollTop = dom.chat.scrollHeight;
  updateTurnRailActive();
}

function nearBottom() {
  return dom.chat.scrollHeight - dom.chat.scrollTop - dom.chat.clientHeight < 80;
}

function handleScroll() {
  const near = nearBottom();
  state.stick = near;
  const hasMessages = Boolean(currentConversation()?.messages.length);
  dom.scrollBottom.hidden = near || !hasMessages;
  updateTurnRailActive();
}

/* ---------- 会话操作 ---------- */

function switchConversation(id) {
  if (state.audioRecorder) {
    toast('先停止录音，再切换对话。');
    return;
  }
  closeOutlineDrawer();
  clearSelectionBar();
  stopTTS();
  if (id === state.activeId) {
    closeSidebar();
    return;
  }
  if (state.generating) {
    toast('先停止当前回答，再切换对话。');
    return;
  }
  state.activeId = id;
  persistActive();
  renderAll();
  closeSidebar();
  dom.input.focus();
}

function newChat() {
  if (!dom.settingsModal.hidden) return;
  if (state.generating) {
    toast('先停止当前回答，再开新对话。');
    return;
  }
  if (state.audioRecorder) {
    toast('先停止录音，再开新对话。');
    return;
  }
  state.searchQuery = '';
  dom.convSearch.value = '';
  closeOutlineDrawer();
  clearSelectionBar(true);
  stopTTS();

  const conversation = currentConversation();
  if (conversation && !conversation.parentId && conversation.messages.length === 0) {
    closeSidebar();
    dom.input.focus();
    return;
  }

  const fresh = createConversation({ persist: false });
  state.conversations = state.conversations.filter(
    (item) => item.id === fresh.id || item.messages.length > 0 || item.parentId,
  );
  persistConversations();
  persistActive();
  renderAll();
  closeSidebar();
  dom.input.focus();
}

function handleDeleteConversation(conversation, button) {
  if (button.dataset.confirm === '1') {
    deleteConversation(conversation.id);
    return;
  }
  button.dataset.confirm = '1';
  button.classList.add('confirm');
  button.title = '再点一次删除';
  window.clearTimeout(button._timer);
  button._timer = window.setTimeout(() => {
    button.dataset.confirm = '';
    button.classList.remove('confirm');
    button.title = '删除对话';
  }, 2600);
}

function deleteConversation(id) {
  if (state.generating) {
    toast('先停止当前回答，再删除对话。');
    return;
  }

  const wasActive = rootConversation()?.id === id;
  const ids = new Set(subtreeIds(id));
  if (wasActive || ids.has(state.activeId)) stopTTS();
  state.conversations = state.conversations.filter((conversation) => !ids.has(conversation.id));

  if (wasActive) {
    const next = sortedConversations()[0];
    state.activeId = next?.id || '';
    if (!state.activeId) createConversation({ persist: false });
  }

  persistConversations();
  persistActive();
  if (wasActive) {
    renderAll();
  } else {
    renderConversations();
  }
}

/* ---------- 侧栏 ---------- */

function paintSidebarCollapsed() {
  const narrow = window.matchMedia('(max-width: 880px)').matches;
  const collapsed = narrow
    ? !dom.app.classList.contains('sidebar-open')
    : Boolean(state.settings.sidebarCollapsed);
  dom.app.classList.toggle('sidebar-collapsed', Boolean(state.settings.sidebarCollapsed));
  const label = collapsed ? '展开侧栏' : '收起侧栏';
  dom.openSidebar.title = label;
  dom.openSidebar.setAttribute('aria-label', label);
  requestAnimationFrame(positionWidthGrip);
}

function toggleSidebarCollapsed() {
  state.settings.sidebarCollapsed = !state.settings.sidebarCollapsed;
  persistSettings();
  paintSidebarCollapsed();
  if (state.settings.sidebarCollapsed) closeSidebar();
}

function focusSidebarSearch() {
  if (state.settings.sidebarCollapsed) {
    state.settings.sidebarCollapsed = false;
    persistSettings();
    paintSidebarCollapsed();
  }
  requestAnimationFrame(() => {
    dom.convSearch.focus();
    dom.convSearch.select();
  });
}

function openSidebar() {
  dom.app.classList.add('sidebar-open');
  dom.scrim.hidden = false;
  paintSidebarCollapsed();
}

function closeSidebar() {
  dom.app.classList.remove('sidebar-open');
  dom.scrim.hidden = true;
  paintSidebarCollapsed();
}

/* ---------- 发送与流式接收 ---------- */

function buildApiMessages(conversation, excludeId) {
  const messages = [];
  const system = state.settings.systemPrompt.trim() || defaultSystemPrompt();
  if (system) messages.push({ role: 'system', content: system });

  if (conversation.parentId) {
    const path = threadPath(conversation);
    const parent = parentOf(conversation);
    const context = [
      '你正在一个多层级子会话中回答；每一层只讨论上一级里选出的一个小问题。',
      `层级路径：${path.map((item, index) => `${index === 0 ? '主会话' : `L${index}`}「${item.title}」`).join(' / ')}`,
      parent ? `直接上级会话：${parent.title}` : '',
      conversation.anchorContext ? `上级消息相关片段：\n${truncate(conversation.anchorContext, 1800)}` : '',
      conversation.anchorText ? `用户关注/选中的片段：「${truncate(conversation.anchorText, 200)}」` : '',
      path.length > 3 ? '更早的层级只作为背景，不要逐层复述。' : '',
      '只围绕这个子问题回答；不要改动任何上级会话。',
    ].filter(Boolean).join('\n\n');
    messages.push({ role: 'system', content: context });
  }

  // 目前请求不带 tools，按 DeepSeek 文档 reasoning_content 无需回传。
  // 接入联网工具后，assistant 的 server_tool_calls（含 read_link signature）必须原样回传。
  for (const message of conversation.messages) {
    if (message.id === excludeId) continue;
    if (message.error) continue;
    if (!message.content && !message.files?.length) continue;

    if (message.role === 'user') {
      if (message.files?.length) {
        const parts = message.files.map((file) => ({ type: 'file', file_id: file.id }));
        if (message.content) parts.push({ type: 'text', text: message.content });
        messages.push({ role: 'user', content: parts });
      } else {
        messages.push({ role: 'user', content: message.content });
      }
      continue;
    }

    const assistant = { role: 'assistant', content: message.content };
    if (message.reasoning) assistant.reasoning_content = message.reasoning;
    if (Array.isArray(message.serverToolCalls) && message.serverToolCalls.length) {
      assistant.server_tool_calls = message.serverToolCalls;
    }
    messages.push(assistant);
  }
  return messages;
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const prompt = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const completion = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  const total = Number(usage.total_tokens ?? prompt + completion);
  const reasoning = Number(usage.completion_tokens_details?.reasoning_tokens ?? 0);
  if (!prompt && !completion && !total) return null;
  return { prompt, completion, total, reasoning };
}

function errorMessage(data, status) {
  const raw = data?.error?.message
    ?? (typeof data?.error === 'string' ? data.error : data?.message);
  const detail = typeof raw === 'string' ? truncate(raw.trim(), 180) : '';
  const code = Number(status) || 500;

  if (code === 401) return 'API Key 无效或没有权限。请检查设置里的 Key。';
  if (code === 402) return '账户余额不足，请到 API 平台充值。';
  if (code === 403) return '这个 Key 没有调用该模型的权限。';
  if (code === 404) return '接口不存在。检查 Base URL 是否填到 /v1，或模型名是否正确。';
  if (code === 429) return '请求太频繁，等几秒再试。';
  if (code === 400) return detail ? `请求参数有误：${detail}` : '请求参数有误，检查模型名与 Base URL。';
  if (code >= 500) return detail ? `API 服务暂时不可用（${detail}）` : 'API 服务暂时不可用，稍后再试。';
  return detail || `请求失败（HTTP ${code}）。`;
}

function humanError(error) {
  const message = String(error?.message || '');
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(message)) {
    return '连不上本机服务，请确认 D&M 仍在运行，然后重试。';
  }
  return message || '请求失败，请稍后重试。';
}

function handleSSE(raw, assistant) {
  const dataLines = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
  }
  if (dataLines.length === 0) return;

  const payload = dataLines.join('\n').trim();
  if (!payload || payload === '[DONE]') return;

  let data;
  try {
    data = JSON.parse(payload);
  } catch {
    return;
  }

  if (data.error) {
    throw new Error(errorMessage(data, data.status || 500));
  }

  const choice = data.choices?.[0];
  const delta = choice?.delta;

  if (choice?.server_tool_event) {
    processToolEvent(assistant, choice.server_tool_event);
  }

  if (delta) {
    if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
      assistant.reasoning += delta.reasoning_content;
    } else if (typeof delta.reasoning === 'string' && delta.reasoning) {
      assistant.reasoning += delta.reasoning;
    }

    if (typeof delta.content === 'string' && delta.content) {
      assistant.content += delta.content;
    } else if (Array.isArray(delta.content)) {
      for (const part of delta.content) {
        if (typeof part?.text === 'string') assistant.content += part.text;
      }
    }

    if (Array.isArray(delta.server_tool_calls)) {
      assistant.serverToolCalls = delta.server_tool_calls;
    }
    if (Array.isArray(delta.annotations)) {
      assistant.annotations = delta.annotations;
    }
  }

  if (choice?.finish_reason) assistant.finishReason = choice.finish_reason;
  if (data.usage) assistant.usage = normalizeUsage(data.usage);

  schedulePaint();
}

function processToolEvent(assistant, event) {
  if (!event || !assistant) return;

  if (event.type === 'call_started') {
    const call = event.call || {};
    assistant.toolEvents.push({
      id: call.id || `step-${event.step}-${assistant.toolEvents.length}`,
      step: event.step,
      type: call.type || '',
      kind: call.kind || '',
      action: call.action || {},
      status: 'running',
      sources: [],
      page: null,
      error: null,
    });
    return;
  }

  if (event.type === 'call_completed') {
    const call = event.call || {};
    let item = assistant.toolEvents.find((entry) => entry.id === call.id);
    if (!item) {
      item = {
        id: call.id || `step-${event.step}-${assistant.toolEvents.length}`,
        step: event.step,
        type: call.type || '',
        kind: call.kind || '',
        action: call.action || {},
        sources: [],
        page: null,
      };
      assistant.toolEvents.push(item);
    }
    item.status = event.status || 'done';
    if (Array.isArray(event.sources)) item.sources = event.sources;
    if (event.page) item.page = event.page;
    if (event.error) item.error = event.error;
  }
}

function hydrateToolEvents(assistant) {
  if (!Array.isArray(assistant.serverToolCalls) || assistant.toolEvents.length) return;
  for (const step of assistant.serverToolCalls) {
    for (const call of step.calls || []) {
      assistant.toolEvents.push({
        id: call.id || uid(),
        step: step.index,
        type: call.type || '',
        kind: call.kind || '',
        action: call.action || {},
        status: 'done',
        sources: [],
        page: null,
        error: null,
      });
    }
  }
}

async function consumeSSE(body, assistant) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');

      let split;
      while ((split = buffer.indexOf('\n\n')) >= 0) {
        const raw = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        handleSSE(raw, assistant);
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) handleSSE(buffer, assistant);
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // 忽略
    }
  }
}

function schedulePaint() {
  if (state.paintFrame) return;
  state.paintFrame = requestAnimationFrame(() => {
    state.paintFrame = 0;
    const conversation = currentConversation();
    const message = conversation?.messages.find((item) => item.id === state.streamingId);
    if (!message) return;
    const node = findMessageNode(message.id);
    if (!node) return;
    paintMessage(node, message);
    if (state.stick) pinBottom();
  });
}

function defaultPlaceholder() {
  const conversation = currentConversation();
  if (conversation?.parentId) {
    return `继续问「${truncate(conversation.anchorLabel || conversation.anchorText || '这个点', 14)}」…`;
  }
  return '';
}

function setGeneratingUI(generating) {
  dom.sendBtn.hidden = generating;
  dom.stopBtn.hidden = !generating;
  dom.stopBtn.disabled = false;
  dom.modelSelect.disabled = generating;
  dom.input.placeholder = generating ? '正在回答… 可以先想下一个问题' : defaultPlaceholder();
  dom.attachBtn.disabled = generating;
  dom.cameraBtn.disabled = generating;
  dom.micBtn.disabled = generating;
  renderThinkingToggle();
  renderWebToggle();
}

async function runStream(conversation, assistant, node) {
  const controller = new AbortController();
  state.abort = controller;
  const started = performance.now();

  try {
    const messages = buildApiMessages(conversation, assistant.id);
    const payload = {
      baseUrl: state.settings.baseUrl,
      model: state.settings.model,
      messages,
    };
    if (supportsThinking()) payload.thinkingLevel = conversation.thinkingLevel || 'high';
    if (supportsWebTools() && conversation.webSearch) payload.webSearch = true;

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': state.settings.apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(errorMessage(data, response.status));
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      const data = await response.json().catch(() => null);
      throw new Error(errorMessage(data, response.status || 500));
    }

    await consumeSSE(response.body, assistant);

    if (!assistant.content && !assistant.reasoning) {
      assistant.content = '（模型没有返回内容）';
    }
  } catch (error) {
    if (error?.name === 'AbortError' || controller.signal.aborted) {
      assistant.stopped = true;
    } else {
      assistant.error = humanError(error);
    }
    try {
      controller.abort();
    } catch {
      // 忽略
    }
  } finally {
    assistant.durationMs = Math.max(0, Math.round(performance.now() - started));

    if (state.paintFrame) {
      cancelAnimationFrame(state.paintFrame);
      state.paintFrame = 0;
    }

    state.generating = false;
    state.streamingId = '';
    state.abort = null;
    hydrateToolEvents(assistant);

    if (assistant.stopped && !assistant.content && !assistant.reasoning) {
      conversation.messages = conversation.messages.filter((message) => message.id !== assistant.id);
      node?.remove();
    } else if (node) {
      paintMessage(node, assistant);
    }

    conversation.updatedAt = nowIso();
    persistConversations();
    setGeneratingUI(false);
    renderConversations();
    renderHeader();
    renderMessagesVisibility();
    if (state.stick) pinBottom();
    dom.input.focus();
  }
}

function renderMessagesVisibility() {
  const conversation = currentConversation();
  const hasMessages = Boolean(conversation?.messages.length);
  dom.emptyState.hidden = hasMessages || Boolean(conversation?.parentId);
  dom.messages.hidden = !hasMessages;
  syncMossVisibility();
  if (!hasMessages) {
    dom.scrollBottom.hidden = true;
  }
  renderThreadContext();
  renderThreadOutline();
  renderTurnRail();
}

async function submit() {
  if (state.generating) {
    toast('这一轮还在回答，先停止或等它结束。');
    return;
  }
  if (state.audioRecorder) {
    toast('先停止录音，再发送消息。');
    return;
  }

  const text = dom.input.value.trim();
  let conversation = currentConversation();
  if (!conversation) conversation = createConversation();

  const pendingFiles = conversation.pendingFiles || [];
  if (pendingFiles.some((file) => file.status === 'uploading')) {
    toast('文件还在解析，等一下再发送。');
    return;
  }
  const readyFiles = pendingFiles.filter((file) => file.status === 'ready' && file.id);

  if (!text && readyFiles.length === 0) return;

  if (!state.settings.apiKey.trim()) {
    openSettings();
    return;
  }

  const firstUserMessage = !conversation.messages.some((message) => message.role === 'user');
  dom.input.value = '';

  const userMessage = {
    id: uid(),
    role: 'user',
    content: text,
    files: readyFiles.map((file) => ({
      id: file.id,
      filename: file.filename,
      purpose: file.purpose,
      thumb: file.thumb || '',
    })),
    createdAt: nowIso(),
  };
  conversation.messages.push(userMessage);
  conversation.pendingFiles = [];
  if (!conversation.parentId && (firstUserMessage || conversation.title === '新对话')) {
    conversation.title = text ? makeTitle(text) : `关于 ${readyFiles[0]?.filename || '文件'}`;
  }
  conversation.updatedAt = nowIso();
  clearSelectionBar(true);
  renderFileChips();

  const assistant = {
    id: uid(),
    role: 'assistant',
    content: '',
    reasoning: '',
    model: state.settings.model,
    createdAt: nowIso(),
    toolEvents: [],
    serverToolCalls: null,
    annotations: [],
  };
  conversation.messages.push(assistant);

  state.generating = true;
  state.streamingId = assistant.id;
  state.stick = true;

  dom.emptyState.hidden = true;
  dom.messages.hidden = false;
  appendMessageNode(userMessage);
  const node = appendMessageNode(assistant);

  setGeneratingUI(true);
  persistConversations();
  renderConversations();
  renderHeader();
  pinBottom();
  dom.input.focus();

  await runStream(conversation, assistant, node);
}

function regenerateLast() {
  if (state.generating) return;
  if (!state.settings.apiKey.trim()) {
    openSettings();
    return;
  }

  const conversation = currentConversation();
  if (!conversation) return;

  let lastUserIndex = -1;
  for (let index = conversation.messages.length - 1; index >= 0; index -= 1) {
    if (conversation.messages[index].role === 'user') {
      lastUserIndex = index;
      break;
    }
  }
  if (lastUserIndex < 0) return;

  conversation.messages.splice(lastUserIndex + 1);
  const assistant = {
    id: uid(),
    role: 'assistant',
    content: '',
    reasoning: '',
    model: state.settings.model,
    createdAt: nowIso(),
    toolEvents: [],
    serverToolCalls: null,
    annotations: [],
  };
  conversation.messages.push(assistant);
  conversation.updatedAt = nowIso();

  state.generating = true;
  state.streamingId = assistant.id;
  state.stick = true;

  renderMessages();
  setGeneratingUI(true);
  renderHeader();
  renderConversations();
  persistConversations();

  const node = findMessageNode(assistant.id);
  pinBottom();
  void runStream(conversation, assistant, node);
}

/* ---------- 设置 ---------- */

function populateSettingsForm() {
  dom.setKey.value = state.settings.apiKey;
  dom.setKey.type = 'password';
  dom.toggleKey.setAttribute('aria-label', '显示 Key');
  dom.toggleKey.querySelector('use')?.setAttribute('href', '#i-eye');

  dom.setBase.value = state.settings.baseUrl;
  dom.setModel.value = state.settings.model;
  dom.setSystem.value = state.settings.systemPrompt;
  dom.setThinkingLevel.value = state.settings.thinkingLevel;
  dom.setVoice.value = state.settings.ttsVoice;
  dom.testResult.textContent = '';
  dom.testResult.className = 'test-result';
  state.modalTheme = state.settings.theme;
  state.modalFontSizePx = state.settings.fontSizePx;
  state.modalFontFamily = state.settings.fontFamily;
  state.modalChatWidthPx = state.settings.chatWidthPx;
  syncThemeChoice();
  syncFontChoices();
  syncFontSizeSetting();
  syncChatWidthSetting();
}

function openSettings() {
  if (!dom.settingsModal.hidden) return;
  clearSelectionBar();
  closeSidebar();
  state.lastFocus = document.activeElement;
  populateSettingsForm();
  dom.settingsModal.hidden = false;
  const body = dom.settingsModal.querySelector('.modal-body');
  if (body) body.scrollTop = 0;
  document.addEventListener('keydown', onModalKeydown);
  window.setTimeout(() => {
    const target = state.settings.apiKey ? dom.setBase : dom.setKey;
    target.focus();
  }, 40);
}

function closeSettings() {
  if (dom.settingsModal.hidden) return;
  dom.settingsModal.hidden = true;
  document.removeEventListener('keydown', onModalKeydown);
  paintTheme(state.settings.theme);
  paintReading(state.settings.fontSizePx, state.settings.fontFamily);
  paintChatWidth(state.settings.chatWidthPx);
  syncThemeChoice();
  syncFontChoices();
  syncFontSizeSetting();
  syncChatWidthSetting();
  if (state.lastFocus && document.contains(state.lastFocus) && state.lastFocus.offsetParent !== null) {
    state.lastFocus.focus();
  } else {
    dom.input.focus();
  }
}

function onModalKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeSettings();
    return;
  }
  if (event.key !== 'Tab') return;

  const focusables = [...dom.settingsModal.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href]',
  )].filter((element) => element.offsetParent !== null);

  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function chooseModalTheme(theme) {
  state.modalTheme = theme;
  syncThemeChoice();
  paintTheme(theme);
}

async function testConnection() {
  const key = dom.setKey.value.trim().replace(/^Bearer\s+/i, '');
  const base = dom.setBase.value.trim() || DEFAULTS.baseUrl;

  if (!key) {
    dom.testResult.textContent = '先填写 API Key';
    dom.testResult.className = 'test-result bad';
    dom.setKey.focus();
    return;
  }

  dom.testConn.disabled = true;
  dom.testConn.textContent = '测试中…';
  dom.testResult.textContent = '正在连接…';
  dom.testResult.className = 'test-result';

  try {
    const response = await fetch('/api/models', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
      },
      body: JSON.stringify({ baseUrl: base }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 404) {
        dom.testResult.textContent = '已连上，但该服务没有 /models 接口；可以直接发消息验证。';
        dom.testResult.className = 'test-result';
        return;
      }
      throw new Error(errorMessage(data, response.status));
    }

    const ids = [...new Set((data?.data || []).map((item) => item?.id).filter((id) => typeof id === 'string' && id))];
    state.remoteModels = ids;
    renderModelOptions();

    if (ids.length) {
      dom.testResult.textContent = `连接成功 · ${ids.length} 个模型可用`;
      dom.testResult.className = 'test-result ok';
    } else {
      dom.testResult.textContent = '连接成功。该服务没有返回模型列表。';
      dom.testResult.className = 'test-result ok';
    }
  } catch (error) {
    dom.testResult.textContent = humanError(error);
    dom.testResult.className = 'test-result bad';
  } finally {
    dom.testConn.disabled = false;
    dom.testConn.textContent = '测试连接';
  }
}

function saveSettings() {
  const key = dom.setKey.value.trim().replace(/^Bearer\s+/i, '');
  let base = dom.setBase.value.trim() || DEFAULTS.baseUrl;

  try {
    const url = new URL(base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol');
  } catch {
    toast('Base URL 不合法，请填 http(s) 地址。');
    dom.setBase.focus();
    return;
  }

  base = base.replace(/\/+$/, '').replace(/\/chat\/completions$/i, '');
  const model = dom.setModel.value.trim() || DEFAULTS.model;

  state.settings = {
    ...state.settings,
    apiKey: key,
    baseUrl: base,
    model,
    systemPrompt: dom.setSystem.value,
    thinkingLevel: dom.setThinkingLevel.value,
    ttsVoice: dom.setVoice.value === 'tide' ? 'tide' : 'stella',
    theme: state.modalTheme,
    fontSizePx: state.modalFontSizePx,
    fontFamily: state.modalFontFamily,
    chatWidthPx: state.settings.chatWidthPx,
  };

  const conversation = currentConversation();
  if (conversation && conversation.messages.length === 0) {
    conversation.thinkingLevel = dom.setThinkingLevel.value;
    persistConversations();
  }

  persistSettings();
  renderModelOptions();
  paintTheme(state.settings.theme);
  paintReading(state.settings.fontSizePx, state.settings.fontFamily);
  renderKeyState();
  renderHeader();
  renderThinkingToggle();
  closeSettings();
  void refreshBalance({ silent: true });
  toast('设置已保存。');
}

/* ---------- 复制 ---------- */

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const helper = document.createElement('textarea');
    helper.className = 'copy-helper';
    helper.value = text;
    helper.setAttribute('readonly', '');
    document.body.append(helper);
    helper.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    helper.remove();
    return ok;
  }
}

/* ---------- 文件上传 ---------- */

function filePurpose(file) {
  if (String(file.type || '').startsWith('image/')) return 'rich_layout_recognition';
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const textLike = new Set(['txt', 'md', 'csv', 'json', 'js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'xlsx', 'xls', 'epub', 'mobi']);
  const images = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'tif']);
  if (textLike.has(ext)) return 'user_data';
  if (images.has(ext)) return 'rich_layout_recognition';
  return 'text_recognition';
}

function makeImageThumbnail(file, size = 120) {
  if (!String(file.type || '').startsWith('image/')) return Promise.resolve('');
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve('');
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => resolve('');
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const context = canvas.getContext('2d');
          if (!context) {
            resolve('');
            return;
          }
          const scale = Math.max(size / image.width, size / image.height);
          const width = image.width * scale;
          const height = image.height * scale;
          context.fillStyle = '#fff';
          context.fillRect(0, 0, size, size);
          context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } catch {
          resolve('');
        }
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

function hasDraggedFiles(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

function showDropOverlay() {
  if (!dom.settingsModal.hidden) return;
  dom.dropOverlay.hidden = false;
}

function hideDropOverlay() {
  dom.dropOverlay.hidden = true;
}

function renderFileChips() {
  const conversation = currentConversation();
  const files = conversation?.pendingFiles || [];
  dom.fileChips.hidden = files.length === 0;
  dom.fileChips.replaceChildren();

  for (const file of files) {
    const chip = document.createElement('span');
    chip.className = 'file-chip';

    const thumb = document.createElement('span');
    thumb.className = 'file-chip-thumb';
    if (file.thumb) {
      const image = document.createElement('img');
      image.src = file.thumb;
      image.alt = '';
      thumb.append(image);
    } else {
      thumb.append(icon('file'));
    }
    chip.append(thumb);

    const info = document.createElement('span');
    info.className = 'file-chip-info';

    const name = document.createElement('span');
    name.className = 'file-chip-name';
    name.textContent = file.filename || '文件';
    info.append(name);

    const status = document.createElement('span');
    status.className = 'file-chip-status';
    if (file.status === 'uploading') {
      status.textContent = '解析中';
      status.classList.add('uploading');
    } else if (file.status === 'error') {
      status.textContent = '失败';
      status.classList.add('error');
    } else {
      status.textContent = '就绪';
    }
    info.append(status);
    chip.append(info);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'file-chip-remove';
    remove.setAttribute('aria-label', `移除文件：${file.filename}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      const target = currentConversation();
      if (!target) return;
      target.pendingFiles = target.pendingFiles.filter((item) => item.localId !== file.localId);
      persistConversations();
      renderFileChips();
    });
    chip.append(remove);

    dom.fileChips.append(chip);
  }
}

async function uploadFiles(fileList) {
  const conversation = currentConversation();
  if (!conversation) return;

  const files = [...fileList];
  if (!files.length) return;
  if (!conversation.pendingFiles) conversation.pendingFiles = [];

  for (const file of files) {
    if (file.size > 100 * 1024 * 1024) {
      toast(`「${file.name}」超过 100 MiB。`);
      continue;
    }

    const entry = {
      localId: uid(),
      id: '',
      filename: file.name,
      purpose: filePurpose(file),
      status: 'uploading',
      error: '',
      thumb: '',
    };
    conversation.pendingFiles.push(entry);
    persistConversations();
    if (currentConversation()?.id === conversation.id) renderFileChips();

    if (String(file.type || '').startsWith('image/')) {
      void makeImageThumbnail(file).then((thumb) => {
        if (!thumb) return;
        const target = state.conversations.find((item) => item.id === conversation.id);
        const pending = target?.pendingFiles.find((item) => item.localId === entry.localId);
        if (!pending) return;
        pending.thumb = thumb;
        persistConversations();
        if (currentConversation()?.id === conversation.id) renderFileChips();
      });
    }

    const form = new FormData();
    form.append('purpose', entry.purpose);
    form.append('file', file, file.name);

    try {
      const response = await fetch(`/api/files?baseUrl=${encodeURIComponent(state.settings.baseUrl)}`, {
        method: 'POST',
        headers: { 'x-api-key': state.settings.apiKey },
        body: form,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.id) {
        throw new Error(errorMessage(data, response.status || 500));
      }

      const target = state.conversations.find((item) => item.id === conversation.id);
      const pending = target?.pendingFiles.find((item) => item.localId === entry.localId);
      if (!pending) continue;

      pending.id = data.id;
      pending.status = 'ready';
      pending.filename = data.filename || entry.filename;
      pending.purpose = data.purpose || entry.purpose;
    } catch (error) {
      const target = state.conversations.find((item) => item.id === conversation.id);
      const pending = target?.pendingFiles.find((item) => item.localId === entry.localId);
      if (pending) {
        pending.status = 'error';
        pending.error = humanError(error);
      }
      toast(`「${file.name}」上传失败：${humanError(error)}`, 3800);
    }

    persistConversations();
    if (currentConversation()?.id === conversation.id) renderFileChips();
  }
}

/* ---------- 语音输入 ---------- */

function mergeAudioChunks(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function downsampleAudio(input, inputRate, outputRate) {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const length = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(input.length - 1, left + 1);
    const fraction = position - left;
    output[index] = input[left] * (1 - fraction) + input[right] * fraction;
  }
  return output;
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

function updateRecordingTime() {
  if (!state.audioRecorder) return;
  const seconds = Math.floor((Date.now() - state.audioRecorder.startedAt) / 1000);
  dom.recordingTime.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

async function startRecording() {
  if (state.generating || state.audioRecorder) return;
  if (!state.settings.apiKey.trim()) {
    openSettings();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
    toast('当前浏览器不支持麦克风录音。');
    return;
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
  } catch {
    toast('没有拿到麦克风权限，请检查系统设置。');
    return;
  }

  let ctx;
  try {
    try {
      ctx = new AudioContext({ sampleRate: 16000 });
    } catch {
      ctx = new AudioContext();
    }
    await ctx.resume();
  } catch {
    stream.getTracks().forEach((track) => track.stop());
    toast('麦克风初始化失败，请重试。');
    return;
  }

  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks = [];

  processor.onaudioprocess = (event) => {
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(processor);
  processor.connect(mute);
  mute.connect(ctx.destination);

  state.audioRecorder = {
    stream,
    ctx,
    source,
    processor,
    chunks,
    sampleRate: ctx.sampleRate,
    startedAt: Date.now(),
    timer: window.setInterval(updateRecordingTime, 250),
    autoStop: window.setTimeout(() => stopRecording(), 120000),
  };

  dom.recordingBar.hidden = false;
  dom.micBtn.classList.add('recording');
  dom.micBtn.disabled = true;
  dom.attachBtn.disabled = true;
  dom.cameraBtn.disabled = true;
  dom.recordingTime.textContent = '0:00';
}

async function finishRecording(transcribe) {
  const recorder = state.audioRecorder;
  if (!recorder) return;

  window.clearInterval(recorder.timer);
  window.clearTimeout(recorder.autoStop);
  try {
    recorder.processor.disconnect();
    recorder.source.disconnect();
    recorder.stream.getTracks().forEach((track) => track.stop());
    await recorder.ctx.close();
  } catch {
    // 忽略
  }

  state.audioRecorder = null;
  dom.recordingBar.hidden = true;
  dom.micBtn.classList.remove('recording');
  dom.micBtn.disabled = false;
  dom.attachBtn.disabled = false;
  dom.cameraBtn.disabled = false;

  const duration = Date.now() - recorder.startedAt;
  if (!transcribe || duration < 500) return;

  const merged = mergeAudioChunks(recorder.chunks);
  if (!merged.length) {
    toast('没有录到声音。');
    return;
  }

  const samples = downsampleAudio(merged, recorder.sampleRate, 16000);
  const blob = encodeWav(samples, 16000);
  dom.micBtn.disabled = true;
  toast('正在转写…', 2200);

  try {
    const response = await fetch(`/api/asr?baseUrl=${encodeURIComponent(state.settings.baseUrl)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'x-api-key': state.settings.apiKey,
      },
      body: blob,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(errorMessage(data, response.status));
    const text = String(data?.text || '').trim();
    if (!text) {
      toast('没有识别出文字。');
      return;
    }

    const prefix = dom.input.value && !/\s$/.test(dom.input.value) ? ' ' : '';
    dom.input.value += `${prefix}${text}`;
    dom.input.focus();
  } catch (error) {
    toast(humanError(error), 3800);
  } finally {
    dom.micBtn.disabled = false;
  }
}

function stopRecording() {
  void finishRecording(true);
}

function cancelRecording() {
  void finishRecording(false);
}

/* ---------- 朗读 ---------- */

function refreshMessageActions(messageId) {
  const message = currentConversation()?.messages.find((item) => item.id === messageId);
  const node = findMessageNode(messageId);
  if (message && node) renderActions(node, message);
}

function stopTTS() {
  const previousId = state.ttsMessageId;

  if (state.ttsAudio) {
    try {
      state.ttsAudio.source.stop();
      state.ttsAudio.context.close();
    } catch {
      // 忽略
    }
  }

  state.ttsAudio = null;
  state.ttsMessageId = '';
  if (previousId) refreshMessageActions(previousId);
}

async function toggleTTS(message) {
  if (state.ttsMessageId === message.id) {
    stopTTS();
    return;
  }

  if (!state.settings.apiKey.trim()) {
    openSettings();
    return;
  }

  stopTTS();
  state.ttsMessageId = message.id;
  refreshMessageActions(message.id);

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': state.settings.apiKey,
      },
      body: JSON.stringify({
        baseUrl: state.settings.baseUrl,
        text: String(message.content).slice(0, 10000),
        voiceId: state.settings.ttsVoice,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(errorMessage(data, response.status));
    }

    const blob = await response.blob();
    const context = new AudioContext();
    await context.resume();
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.addEventListener('ended', stopTTS, { once: true });

    state.ttsAudio = { source, context };
    source.start();
    refreshMessageActions(message.id);
  } catch (error) {
    toast(humanError(error));
    stopTTS();
  }
}

/* ---------- 事件绑定 ---------- */

function bindEvents() {
  dom.newChat.addEventListener('click', newChat);
  dom.newChatTop.addEventListener('click', newChat);
  dom.searchToggleTop.addEventListener('click', focusSidebarSearch);
  dom.convSearch.addEventListener('input', () => {
    state.searchQuery = dom.convSearch.value;
    renderConversations();
  });
  dom.convSearch.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      dom.convSearch.value = '';
      state.searchQuery = '';
      renderConversations();
    }
  });
  dom.convSearchClear.addEventListener('click', () => {
    dom.convSearch.value = '';
    state.searchQuery = '';
    renderConversations();
    dom.convSearch.focus();
  });

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      focusSidebarSearch();
    }
  });

  dom.openSidebar.addEventListener('click', () => {
    if (window.matchMedia('(max-width: 880px)').matches) {
      openSidebar();
    } else {
      toggleSidebarCollapsed();
    }
  });
  dom.closeSidebar.addEventListener('click', closeSidebar);
  dom.scrim.addEventListener('click', closeSidebar);

  const wideSidebar = window.matchMedia('(min-width: 881px)');
  wideSidebar.addEventListener('change', (event) => {
    if (event.matches) closeSidebar();
    paintSidebarCollapsed();
  });
  dom.openSettingsTop.addEventListener('click', openSettings);
  dom.keySetup.addEventListener('click', openSettings);
  dom.balanceState?.addEventListener('click', () => void refreshBalance());

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.conv-card')) closeAllCardMenus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllCardMenus();
  });

  dom.widthDrag.addEventListener('pointerdown', startWidthDrag);
  dom.widthDrag.addEventListener('pointermove', moveWidthDrag);
  dom.widthDrag.addEventListener('pointerup', endWidthDrag);
  dom.widthDrag.addEventListener('pointercancel', endWidthDrag);
  // Fallback when pointer capture is unavailable: keep dragging even after
  // the bar loses the pointer.
  window.addEventListener('pointermove', moveWidthDrag);
  window.addEventListener('pointerup', endWidthDrag);
  window.addEventListener('pointercancel', endWidthDrag);
  dom.widthDrag.addEventListener('dblclick', () => setChatWidth(820, true));
  dom.widthDrag.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') setChatWidth(480, true);
    else if (event.key === 'End') setChatWidth(maxChatWidth(), true);
    else setChatWidth(state.settings.chatWidthPx + (event.key === 'ArrowRight' ? 20 : -20), true);
  });

  window.addEventListener('resize', () => {
    syncChatBounds();
    positionWidthGrip();
    if (!dom.settingsModal.hidden) syncChatWidthSetting();
  });

  if ('ResizeObserver' in window) {
    const boundsObserver = new ResizeObserver(() => syncChatBounds());
    if (dom.topbar) boundsObserver.observe(dom.topbar);
    if (dom.composerWrap) boundsObserver.observe(dom.composerWrap);
  }

  dom.threadContextBack.addEventListener('click', () => {
    const parent = parentOf(currentConversation());
    if (parent) switchConversation(parent.id);
  });

  dom.outlineToggle.addEventListener('click', () => {
    if (window.matchMedia('(max-width: 1100px)').matches) {
      openOutlineDrawer();
      return;
    }
    state.settings.outlineRailCollapsed = !state.settings.outlineRailCollapsed;
    persistSettings();
    renderThreadOutline();
  });

  dom.outlineClose.addEventListener('click', () => {
    if (window.matchMedia('(max-width: 1100px)').matches) {
      closeOutlineDrawer();
      return;
    }
    state.settings.outlineRailCollapsed = true;
    persistSettings();
    renderThreadOutline();
  });

  dom.outlineScrim.addEventListener('click', closeOutlineDrawer);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dom.app.classList.contains('outline-open')) {
      closeOutlineDrawer();
    }
  });

  const wideOutline = window.matchMedia('(min-width: 1101px)');
  wideOutline.addEventListener('change', (event) => {
    if (event.matches) closeOutlineDrawer();
    renderThreadOutline();
  });

  dom.threadContextClose.addEventListener('click', () => {
    const conversation = currentConversation();
    if (!conversation?.parentId) return;
    if (dom.threadContextClose.dataset.confirm === '1') {
      deleteThread(conversation.id);
      return;
    }
    const count = descendantCount(conversation.id);
    dom.threadContextClose.dataset.confirm = '1';
    dom.threadContextClose.classList.add('confirm');
    dom.threadContextClose.textContent = '确认删除';
    toast(count > 0 ? `再点一次，会连同 ${count} 个下级一起删除。` : '再点一次，删除这个子会话。', 2400);
    window.clearTimeout(dom.threadContextClose._timer);
    dom.threadContextClose._timer = window.setTimeout(() => {
      dom.threadContextClose.dataset.confirm = '';
      dom.threadContextClose.classList.remove('confirm');
      const current = currentConversation();
      const currentCount = current ? descendantCount(current.id) : 0;
      dom.threadContextClose.textContent = currentCount > 0 ? `删除本支 · ${currentCount}` : '删除子会话';
    }, 2600);
  });

  dom.selectionOpen.addEventListener('click', () => {
    if (!state.selection) return;
    openChildThread(state.selection.messageId, state.selection.text);
  });

  dom.selectionClear.addEventListener('click', () => {
    clearSelectionBar(true);
  });

  document.addEventListener('selectionchange', handleSelectionChange);

  dom.webToggle.addEventListener('click', () => {
    if (dom.webToggle.disabled) return;
    const conversation = currentConversation();
    if (!conversation) return;
    conversation.webSearch = !conversation.webSearch;
    persistConversations();
    renderWebToggle();
  });

  dom.attachBtn.addEventListener('click', () => {
    if (!state.settings.apiKey.trim()) {
      openSettings();
      return;
    }
    dom.fileInput.click();
  });

  dom.fileInput.addEventListener('change', () => {
    const files = dom.fileInput.files;
    if (files?.length) void uploadFiles(files);
    dom.fileInput.value = '';
  });

  let dragDepth = 0;

  window.addEventListener('dragenter', (event) => {
    if (!hasDraggedFiles(event) || !dom.settingsModal.hidden) return;
    event.preventDefault();
    dragDepth += 1;
    showDropOverlay();
  });

  window.addEventListener('dragover', (event) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    if (dom.settingsModal.hidden) showDropOverlay();
  });

  window.addEventListener('dragleave', () => {
    if (dom.dropOverlay.hidden) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) hideDropOverlay();
  });

  window.addEventListener('drop', (event) => {
    const files = [...(event.dataTransfer?.files || [])];
    dragDepth = 0;
    hideDropOverlay();
    if (!files.length) return;
    event.preventDefault();
    if (!dom.settingsModal.hidden) return;
    if (state.audioRecorder) {
      toast('先停止录音，再上传文件。');
      return;
    }
    if (state.generating) {
      toast('先停止当前回答，再上传文件。');
      return;
    }
    if (!state.settings.apiKey.trim()) {
      openSettings();
      toast('先配置 API Key，再上传文件。', 2000);
      return;
    }
    void uploadFiles(files);
    toast(`正在上传 ${files.length} 个文件…`, 1800);
  });

  window.addEventListener('dragend', () => {
    dragDepth = 0;
    hideDropOverlay();
  });

  window.addEventListener('blur', () => {
    dragDepth = 0;
    hideDropOverlay();
  });

  dom.cameraBtn.addEventListener('click', () => {
    if (!state.settings.apiKey.trim()) {
      openSettings();
      return;
    }
    if (state.generating) {
      toast('先停止当前回答，再拍照。');
      return;
    }
    dom.cameraInput.click();
  });

  dom.cameraInput.addEventListener('change', () => {
    const files = dom.cameraInput.files;
    if (files?.length) void uploadFiles(files);
    dom.cameraInput.value = '';
  });

  dom.micBtn.addEventListener('click', () => {
    if (state.audioRecorder) return;
    void startRecording();
  });

  dom.stopRecording.addEventListener('click', stopRecording);
  dom.cancelRecording.addEventListener('click', cancelRecording);

  dom.themeToggle.addEventListener('click', () => {
    const next = resolvedTheme(state.settings.theme) === 'dark' ? 'light' : 'dark';
    state.settings.theme = next;
    persistSettings();
    paintTheme(state.settings.theme);
    toast(next === 'dark' ? '已切换到深色。' : '已切换到浅色。', 1600);
  });

  dom.modelSelect.addEventListener('change', () => {
    state.settings.model = dom.modelSelect.value;
    persistSettings();
    renderHeader();
    renderThinkingToggle();
    toast(`模型已切换：${state.settings.model}`, 1600);
  });

  dom.thinkingToggle.addEventListener('click', () => {
    if (dom.thinkingToggle.disabled) return;
    const conversation = currentConversation();
    if (!conversation) return;
    if (conversation.thinkingLevel === 'none') {
      conversation.thinkingLevel = state.lastThinkingLevel || 'high';
    } else {
      state.lastThinkingLevel = conversation.thinkingLevel || 'high';
      conversation.thinkingLevel = 'none';
    }
    persistConversations();
    renderThinkingToggle();
  });

  dom.thinkingLevel.addEventListener('change', () => {
    if (dom.thinkingLevel.disabled) return;
    const conversation = currentConversation();
    if (!conversation) return;
    conversation.thinkingLevel = dom.thinkingLevel.value;
    state.lastThinkingLevel = dom.thinkingLevel.value;
    persistConversations();
    renderThinkingToggle();
  });

  dom.composer.addEventListener('submit', (event) => {
    event.preventDefault();
    void submit();
  });

  dom.stopBtn.addEventListener('click', () => {
    if (!state.abort) return;
    dom.stopBtn.disabled = true;
    state.abort.abort();
  });

  dom.input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (state.composing || event.isComposing) return;
    event.preventDefault();
    dom.composer.requestSubmit();
  });

  dom.input.addEventListener('compositionstart', () => {
    state.composing = true;
  });
  dom.input.addEventListener('compositionend', () => {
    state.composing = false;
  });

  dom.chat.addEventListener('scroll', handleScroll, { passive: true });

  dom.scrollBottom.addEventListener('click', () => {
    state.stick = true;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    dom.chat.scrollTo({ top: dom.chat.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
    dom.scrollBottom.hidden = true;
  });

  dom.messages.addEventListener('click', async (event) => {
    const button = event.target.closest('.copy-code');
    if (!button) return;
    const code = button.closest('.code-block')?.querySelector('pre code')?.textContent || '';
    const ok = await copyText(code);
    if (ok) {
      const original = button.textContent;
      button.textContent = '已复制';
      window.setTimeout(() => {
        button.textContent = original;
      }, 1400);
    }
  });

  dom.settingsModal.querySelectorAll('[data-close-settings]').forEach((element) => {
    element.addEventListener('click', closeSettings);
  });

  dom.toggleKey.addEventListener('click', () => {
    const showing = dom.setKey.type === 'text';
    dom.setKey.type = showing ? 'password' : 'text';
    dom.toggleKey.setAttribute('aria-label', showing ? '显示 Key' : '隐藏 Key');
    dom.toggleKey.querySelector('use')?.setAttribute('href', showing ? '#i-eye' : '#i-eye-off');
    dom.setKey.focus();
  });

  dom.testConn.addEventListener('click', () => {
    void testConnection();
  });

  dom.saveSettings.addEventListener('click', saveSettings);

  dom.exportAll.addEventListener('click', () => exportConversations(state.conversations, '全部对话'));
  dom.importAll.addEventListener('click', () => dom.importFile.click());
  dom.importFile.addEventListener('change', () => {
    const file = dom.importFile.files?.[0];
    dom.importFile.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast('导入文件不能超过 20 MB。');
      return;
    }
    file.text().then((text) => {
      try {
        importConversations(JSON.parse(text));
      } catch (error) {
        toast(`导入失败：${error instanceof Error ? error.message : '文件格式不正确。'}`);
      }
    }).catch(() => toast('读取文件失败。'));
  });

  dom.themeChoice.querySelectorAll('[data-theme-choice]').forEach((button) => {
    button.addEventListener('click', () => chooseModalTheme(button.dataset.themeChoice));
  });

  dom.fontSizeRange.addEventListener('input', () => {
    applyModalFontSize(Number(dom.fontSizeRange.value));
  });

  dom.fontFamilyChoice.querySelectorAll('[data-font-family]').forEach((button) => {
    button.addEventListener('click', () => chooseModalFontFamily(button.dataset.fontFamily));
  });



  document.addEventListener('keydown', (event) => {
    if (!dom.settingsModal.hidden) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      newChat();
      return;
    }
    if (event.key === 'Escape') {
      closeSidebar();
    }
  });
}

/* ---------- 启动 ---------- */


function initQuietDots() {
  const svg = document.querySelector('.whale-d');
  const dots = svg ? [...svg.querySelectorAll('.wd-dot')] : [];
  if (!dots.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let timer = 0;
  let alive = true;

  function pulse() {
    if (!alive || document.hidden) return;
    if (document.documentElement.dataset.scheme !== 'dark') return;
    const dot = dots[Math.floor(Math.random() * dots.length)];
    if (!dot || dot.classList.contains('is-quiet-hot')) return;
    dot.classList.add('is-quiet-hot');
    window.setTimeout(() => dot.classList.remove('is-quiet-hot'), 1500 + Math.random() * 1100);
    if (Math.random() < .28) {
      const second = dots[Math.floor(Math.random() * dots.length)];
      if (second && second !== dot) {
        second.classList.add('is-quiet-hot');
        window.setTimeout(() => second.classList.remove('is-quiet-hot'), 1300 + Math.random() * 900);
      }
    }
  }

  function schedule() {
    if (!alive) return;
    pulse();
    timer = window.setTimeout(schedule, 680 + Math.random() * 720);
  }

  schedule();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      alive = false;
      window.clearTimeout(timer);
    } else if (!alive) {
      alive = true;
      schedule();
    }
  }, { passive: true });
}

function initNeuralD() {
  const svg = document.querySelector('.whale-d');
  const layer = svg?.querySelector('.wd-neural');
  if (!svg || !layer) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const dots = [...svg.querySelectorAll('.wd-dot')];
  if (dots.length < 20) return;
  const nodes = dots.map((dot, index) => ({
    dot,
    index,
    x: Number(dot.getAttribute('cx')),
    y: Number(dot.getAttribute('cy')),
    edges: [],
  }));

  // A sparse mesh reads as a network; the full dot matrix stays as the membrane.
  const graph = nodes.filter((node) => node.index % 3 === 0);
  graph.forEach((node) => node.dot.classList.add('wd-net-node'));
  const edgeKeys = new Set();
  const svgNs = 'http://www.w3.org/2000/svg';

  for (const a of graph) {
    const nearest = graph
      .filter((b) => b !== a)
      .map((b) => ({ b, d: Math.hypot(a.x - b.x, a.y - b.y) }))
      .sort((u, v) => u.d - v.d)
      .slice(0, 2);

    for (const { b, d } of nearest) {
      if (d > 110) continue;
      const key = a.index < b.index ? `${a.index}-${b.index}` : `${b.index}-${a.index}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);

      const line = document.createElementNS(svgNs, 'line');
      line.setAttribute('x1', a.x);
      line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x);
      line.setAttribute('y2', b.y);
      line.setAttribute('class', 'wd-synapse');
      layer.append(line);

      const edge = { line, a, b };
      a.edges.push(edge);
      b.edges.push(edge);
    }
  }

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const rand = (min, max) => min + Math.random() * (max - min);

  function sprout(from) {
    if (document.documentElement.dataset.scheme !== 'dark') return;
    const angle = Math.random() * Math.PI * 2;
    const distance = rand(42, 120);
    const x2 = clamp(from.x + Math.cos(angle) * distance, 150, 700);
    const y2 = clamp(from.y + Math.sin(angle) * distance, 110, 870);
    const mx = (from.x + x2) / 2 + rand(-26, 26);
    const my = (from.y + y2) / 2 + rand(-26, 26);

    const path = document.createElementNS(svgNs, 'path');
    path.setAttribute('d', `M${from.x} ${from.y} Q${mx} ${my} ${x2} ${y2}`);
    path.setAttribute('class', 'wd-sprout');
    layer.append(path);

    const neuron = document.createElementNS(svgNs, 'circle');
    neuron.setAttribute('cx', x2);
    neuron.setAttribute('cy', y2);
    neuron.setAttribute('r', rand(1.8, 3.2));
    neuron.setAttribute('class', 'wd-neuron');
    layer.append(neuron);

    window.setTimeout(() => {
      path.remove();
      neuron.remove();
    }, 2300);
  }

  function fire(node) {
    if (document.documentElement.dataset.scheme !== 'dark') return;
    const hotEdges = node.edges;
    node.dot.classList.add('is-hot');
    hotEdges.forEach((edge) => edge.line.classList.add('is-hot'));

    const edge = hotEdges.length
      ? hotEdges[Math.floor(Math.random() * hotEdges.length)]
      : null;
    const neighbor = edge ? (edge.a === node ? edge.b : edge.a) : null;
    neighbor?.dot.classList.add('is-hot');

    const hold = rand(360, 620);
    window.setTimeout(() => {
      node.dot.classList.remove('is-hot');
      neighbor?.dot.classList.remove('is-hot');
      hotEdges.forEach((edge) => edge.line.classList.remove('is-hot'));
    }, hold);

  }

  function fireBatch() {
    const count = 2 + Math.floor(Math.random() * 3);
    const chosen = new Set();
    while (chosen.size < count && chosen.size < graph.length) {
      chosen.add(Math.floor(Math.random() * graph.length));
    }
    [...chosen].forEach((index) => fire(graph[index]));
    if (Math.random() < .45) {
      sprout(graph[Math.floor(Math.random() * graph.length)]);
    }
  }

  function schedule() {
    const wait = rand(150, 280);
    window.setTimeout(() => {
      if (document.documentElement.dataset.scheme === 'dark') fireBatch();
      schedule();
    }, wait);
  }

  schedule();
}

function init() {
  paintTheme(state.settings.theme);
  paintReading(state.settings.fontSizePx, state.settings.fontFamily);
  paintChatWidth(state.settings.chatWidthPx);
  paintSidebarCollapsed();
  renderModelOptions();
  ensureActiveConversation();
  bindEvents();
  renderAll();
  setGeneratingUI(false);
  // The dark D keeps the quiet dot field; random highlights are slow and isolated.
  initQuietDots();
  if (state.settings.apiKey.trim()) {
    setTimeout(() => void refreshBalance({ silent: true }), 700);
  }
}

init();

if ('serviceWorker' in navigator
  && (location.protocol === 'https:'
    || location.hostname === '127.0.0.1'
    || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The app remains usable if the browser refuses a service worker.
    });
  });
}
