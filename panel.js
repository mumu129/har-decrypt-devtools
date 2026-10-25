// ============================================================
// 环境诊断
// ============================================================
console.log('%c[HAR-Decrypt][Panel] 脚本已加载', 'color:#4fa3e0;font-weight:bold');
console.log('[HAR-Decrypt][Panel] location.href =', location.href);
console.log('[HAR-Decrypt][Panel] typeof chrome =', typeof chrome);
console.log('[HAR-Decrypt][Panel] typeof browser =', typeof browser);
console.log('[HAR-Decrypt][Panel] chrome.devtools =', typeof chrome !== 'undefined' && chrome.devtools);
console.log('[HAR-Decrypt][Panel] chrome.devtools.network =', typeof chrome !== 'undefined' && chrome.devtools && chrome.devtools.network);

// ================================================================
// 基础工具
// ================================================================
function harTextToBytes(text, encoding) {
  if (!text) return new Uint8Array(0);
  if (encoding === 'base64') {
    const bin = atob(text); const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) > 0xff) return new TextEncoder().encode(text);
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i);
  return out;
}
function bytesToBase64(bytes) {
  let bin = ''; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}
function hexDump(bytes) {
  const lines = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const c = bytes.slice(i, i + 16);
    const hex = Array.from(c).map(b => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = Array.from(c).map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
    lines.push(`${i.toString(16).padStart(6, '0')}  ${hex.padEnd(47)}  ${ascii}`);
  }
  return lines.join('\n') || '（0 字节）';
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function bytesToDisplay(data) {
  if (data == null) return { text: '（空）' };
  if (typeof data === 'string') return { text: data };
  if (data instanceof Uint8Array) {
    try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(data) }; }
    catch { return { text: hexDump(data) }; }
  }
  if (data instanceof ArrayBuffer) return bytesToDisplay(new Uint8Array(data));
  return { text: JSON.stringify(data, null, 2) };
}
function showToast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + type; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 350); }, 1800);
}
function formatTime(iso) {
  if (!iso) return '';
  try { const d = new Date(iso); if (isNaN(d.getTime())) return iso;
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  } catch { return iso; }
}

// ================================================================
// 时间戳识别
// ================================================================
function detectTimestamp(value) {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) return null;
    const s = String(value);
    if (s.length === 10 && s[0] === '1') return 's';
    if (s.length === 13 && s[0] === '1') return 'ms';
    return null;
  }
  if (typeof value === 'string') {
    if (value.length === 10 && /^1\d{9}$/.test(value)) return 's';
    if (value.length === 13 && /^1\d{12}$/.test(value)) return 'ms';
    return null;
  }
  return null;
}
function formatTimestamp(value, unit) {
  const ms = unit === 's' ? Number(value) * 1000 : Number(value);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function renderJsonWithTs(data) {
  const pre = document.createElement('pre');
  pre.className = 'json-view';
  function add(str, cls) {
    if (!str) return;
    if (cls) { const s = document.createElement('span'); s.className = cls; s.textContent = str; pre.appendChild(s); }
    else pre.appendChild(document.createTextNode(str));
  }
  function walk(v, indent) {
    const pad = '  '.repeat(indent);
    if (v === null) { add('null', 'j-null'); return; }
    if (v === undefined) { add('undefined', 'j-null'); return; }
    if (typeof v === 'string') {
      add(JSON.stringify(v), 'j-string');
      const unit = detectTimestamp(v);
      if (unit) add(`  /* ${formatTimestamp(v, unit)} */`, 'j-ts');
      return;
    }
    if (typeof v === 'number') {
      add(String(v), 'j-number');
      const unit = detectTimestamp(v);
      if (unit) add(`  /* ${formatTimestamp(v, unit)} */`, 'j-ts');
      return;
    }
    if (typeof v === 'boolean') { add(String(v), 'j-bool'); return; }
    if (Array.isArray(v)) {
      if (v.length === 0) { add('[]'); return; }
      add('[\n');
      v.forEach((item, i) => { add(pad + '  '); walk(item, indent + 1); if (i < v.length - 1) add(','); add('\n'); });
      add(pad + ']'); return;
    }
    if (typeof v === 'object') {
      const keys = Object.keys(v);
      if (keys.length === 0) { add('{}'); return; }
      add('{\n');
      keys.forEach((k, i) => { add(pad + '  '); add(JSON.stringify(k), 'j-key'); add(': '); walk(v[k], indent + 1); if (i < keys.length - 1) add(','); add('\n'); });
      add(pad + '}'); return;
    }
    add(String(v));
  }
  walk(data, 0);
  return pre;
}

// ================================================================
// 智能解析
// ================================================================
function looksLikeBase64(s) {
  if (!s || s.length < 12 || s.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return false;
  return /[+/=]/.test(s) || s.length >= 16;
}
function smartDecodeValue(v) {
  if (typeof v !== 'string') return v;
  let cur = v;
  for (let i = 0; i < 2; i++) {
    if (!/%[0-9A-Fa-f]{2}/.test(cur)) break;
    try { const d = decodeURIComponent(cur.replace(/\+/g, ' ')); if (d === cur) break; cur = d; } catch { break; }
  }
  if (looksLikeBase64(cur)) {
    try {
      const bin = atob(cur); const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (!/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) return text;
    } catch { /* ignore */ }
  }
  return cur;
}
function tryParseForm(text) {
  if (!text || !text.includes('=')) return null;
  const parts = text.split('&'); const out = {};
  for (const part of parts) {
    const eq = part.indexOf('='); if (eq <= 0) return null;
    const k = smartDecodeValue(part.slice(0, eq).replace(/\+/g, ' '));
    out[k] = smartDecodeValue(part.slice(eq + 1));
  }
  return Object.keys(out).length ? out : null;
}

const BUILTIN_DECODERS = {
  raw: { label: '智能解析', run: (bytes) => {
    let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return bytes; }
    if (!text) return text;
    const t = text.trim();
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) { try { return JSON.parse(t); } catch {} }
    const form = tryParseForm(text); if (form) return form;
    return text;
  }},
  utf8: { label: 'UTF-8 解码', run: (b) => new TextDecoder('utf-8').decode(b) },
  json: { label: 'UTF-8 + JSON 解析', run: (b) => JSON.parse(new TextDecoder('utf-8').decode(b)) },
  gunzip: { label: 'gzip 解压', run: (b) => pako.ungzip(b) },
  inflate: { label: 'zlib inflate 解压', run: (b) => pako.inflate(b) },
  gzipFix: { label: 'gzip 头修复 + 解压（jiem）', run: (bytes) => {
    const t = new Uint8Array(bytes);
    if (t.length < 8) throw new Error('长度 < 8');
    t[0]=0x1f;t[1]=0x8b;t[2]=0x08;t[3]=0x00;t[4]=0x00;t[5]=0x00;t[6]=0x00;t[7]=0x00;
    const raw = pako.ungzip(t);
    return JSON.parse(new TextDecoder('utf-8').decode(raw));
  }},
  base64ThenJson: { label: 'Base64 解码 + JSON 解析', run: (bytes) => {
    const s = new TextDecoder().decode(bytes).trim(); const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder('utf-8').decode(out));
  }},
};

let fileDecoders = {};
let fileRules = [];
let sessionDecoders = {};
let sessionRules = [];

const _compiledFns = new Map();
const _loadedCdns = new Map();

function loadCdnScript(url) {
  if (!url) return Promise.resolve();
  if (_loadedCdns.has(url)) return _loadedCdns.get(url);
  const p = Promise.reject(new Error('MV3 扩展 CSP 禁止加载远程 CDN，请把依赖放到扩展目录并修改 code 中引用方式: ' + url));
  _loadedCdns.set(url, p);
  return p;
}
async function loadCdns(urls) { if (!urls || !urls.length) return; await Promise.all(urls.map(loadCdnScript)); }

function compileDecoderCode(code) {
  try {
    const factory = new Function('pako', `return (${code});`);
    const fn = factory(window.pako);
    if (typeof fn !== 'function') throw new Error('代码必须是一个函数');
    return { fn, error: null };
  } catch (e) { return { fn: null, error: e.message }; }
}
function getCompiledCustom(id) {
  const c = sessionDecoders[id] || fileDecoders[id];
  if (!c) return null;
  const cached = _compiledFns.get(id);
  if (cached && cached.code === c.code) return cached;
  const result = { code: c.code, ...compileDecoderCode(c.code) };
  _compiledFns.set(id, result);
  return result;
}

function refreshFileData() {
  fileDecoders = {};
  fileRules = [];
  if (window.HAR_DECODERS && typeof window.HAR_DECODERS === 'object') {
    for (const [id, d] of Object.entries(window.HAR_DECODERS)) {
      if (BUILTIN_DECODERS[id]) continue;
      if (!d || typeof d.code !== 'string') continue;
      fileDecoders[id] = { label: d.label || id, code: d.code, cdn: d.cdn || [] };
    }
  }
  if (Array.isArray(window.HAR_RULES)) {
    for (const r of window.HAR_RULES) {
      if (!r || !r.pattern) continue;
      fileRules.push({ pattern: String(r.pattern), isRegex: !!r.isRegex, reqDecoder: r.reqDecoder || 'raw', resDecoder: r.resDecoder || 'raw', keys: r.keys || null });
    }
  }
  _compiledFns.clear();
  console.log('[HAR-Decrypt][Panel] 配置文件已加载：算法', Object.keys(fileDecoders).length, '规则', fileRules.length);
}

function getAllDecoders() {
  const all = { ...BUILTIN_DECODERS };
  for (const [id, d] of Object.entries(fileDecoders)) {
    const comp = getCompiledCustom(id);
    all[id] = { label: d.label, run: comp.fn ? async (bytes, ctx) => { await loadCdns(d.cdn); return await comp.fn(bytes, ctx); } : () => { throw new Error('编译失败: ' + comp.error); } };
  }
  for (const [id, d] of Object.entries(sessionDecoders)) {
    if (BUILTIN_DECODERS[id]) continue;
    const comp = getCompiledCustom(id);
    all[id] = { label: `${d.label}（会话）`, run: comp.fn ? async (bytes, ctx) => { await loadCdns(d.cdn); return await comp.fn(bytes, ctx); } : () => { throw new Error('编译失败: ' + comp.error); } };
  }
  return all;
}

function matchRule(url) {
  for (const r of sessionRules) {
    let hit = false;
    if (r.isRegex) { try { hit = new RegExp(r.pattern).test(url); } catch { hit = false; } }
    else hit = url.includes(r.pattern);
    if (hit) return { match: r.pattern, reqDecoder: r.reqDecoder, resDecoder: r.resDecoder, keys: r.keys || null, note: r.isRegex ? `/${r.pattern}/` : r.pattern, _session: true };
  }
  for (const r of fileRules) {
    let hit = false;
    if (r.isRegex) { try { hit = new RegExp(r.pattern).test(url); } catch { hit = false; } }
    else hit = url.includes(r.pattern);
    if (hit) return { match: r.pattern, reqDecoder: r.reqDecoder, resDecoder: r.resDecoder, keys: r.keys || null, note: r.isRegex ? `/${r.pattern}/` : r.pattern };
  }
  return null;
}

refreshFileData();

// ================================================================
// 状态
// ================================================================
const PAGE_SIZE = 300;
const MAX_AUTO_DECRYPT = 5 * 1024 * 1024;
const MAX_FETCH_SIZE = 15 * 1024 * 1024;

function makeFilter() { return { include: new Set(), exclude: new Set() }; }
const state = {
  har: { log: { entries: [] } },
  entries: [], currentIndex: -1,
  decryptState: new Map(), marks: new Map(),
  filters: { method: makeFilter(), type: makeFilter(), mime: makeFilter(), domain: makeFilter() },
  entryMeta: new Map(),
  renderedCount: 0,
};

const devtoolsReqs = new WeakMap();
const searchIndex = new Map();

function getSearchText(idx, entry) {
  if (searchIndex.has(idx)) return searchIndex.get(idx);
  let text = '';
  try { text = JSON.stringify(entry).toLowerCase(); } catch {}
  searchIndex.set(idx, text);
  return text;
}

const $ = (id) => document.getElementById(id);
const stats = $('stats'), toggleFilterBtn = $('toggleFilterBtn');
const autoAllBtn = $('autoDecryptAllBtn'), exportBtn = $('exportBtn');
const entryList = $('entryList'), detailPanel = $('detailPanel'), filterBar = $('filterBar');
const entryListAside = $('entryListAside');
const searchInput = $('searchInput'), searchCount = $('searchCount'), searchClearBtn = $('searchClearBtn');

const TYPE_LABELS = { js:'JS', xhr:'XHR', css:'CSS', html:'HTML', image:'图片', audio:'音频', video:'视频', font:'字体', text:'文本', other:'其它' };
const TYPE_ICONS = { image:'🖼', audio:'🔊', video:'🎬' };

function classifyEntry(entry) {
  const url = (entry.request?.url || '').toLowerCase().split('?')[0];
  const mime = (entry.response?.content?.mimeType || '').toLowerCase();
  const ext = (url.match(/\.([a-z0-9]+)$/) || [])[1] || '';
  if (mime.includes('javascript') || mime.includes('ecmascript') || ext === 'js' || ext === 'mjs' || ext === 'map') return 'js';
  if (mime.includes('css') || ext === 'css') return 'css';
  if (mime.includes('html') || ext === 'html' || ext === 'htm') return 'html';
  if (mime.startsWith('image/') || /^(png|jpg|jpeg|gif|webp|svg|ico|bmp)$/.test(ext)) return 'image';
  if (mime.startsWith('audio/') || /^(mp3|wav|ogg|m4a|flac|aac)$/.test(ext)) return 'audio';
  if (mime.startsWith('video/') || /^(mp4|webm|mkv|avi|mov)$/.test(ext)) return 'video';
  if (mime.includes('font') || /^(woff|woff2|ttf|otf|eot)$/.test(ext)) return 'font';
  if (mime.includes('json') || mime.includes('xml')) return 'xhr';
  const m = (entry.request?.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(m)) return 'xhr';
  if (mime.startsWith('text/') || ext === 'txt' || ext === 'csv' || mime === '') return 'text';
  return 'other';
}
function getMimeKey(entry) { const r = (entry.response?.content?.mimeType || '').split(';')[0].trim().toLowerCase(); return r || '(无 MIME)'; }
function getDomain(entry) { try { return new URL(entry.request.url).hostname || '(无域名)'; } catch { return '(无效 URL)'; } }
function getEntryTime(entry) { const t = entry.startedDateTime; if (!t) return 0; const ms = new Date(t).getTime(); return isNaN(ms) ? 0 : ms; }

// ================================================================
// DevTools 抓取
// ================================================================
const IS_DEVTOOLS = typeof chrome !== 'undefined' && chrome.devtools && chrome.devtools.network;

if (!IS_DEVTOOLS) {
  console.error('[HAR-Decrypt][Panel] ❌ 不是 DevTools 环境');
  detailPanel.innerHTML = '<div class="empty">此页面必须在 DevTools 面板中使用。</div>';
  throw new Error('不是 DevTools 环境');
}
console.log('[HAR-Decrypt][Panel] ✅ DevTools 环境检测通过');

stats.textContent = '等待请求…';
toggleFilterBtn.disabled = false;
autoAllBtn.disabled = false;
exportBtn.disabled = false;

let _pending = [];
let _flushTimer = null;

console.log('[HAR-Decrypt][Panel] 注册 onRequestFinished 监听器');
chrome.devtools.network.onRequestFinished.addListener((req) => {
  console.log('[HAR-Decrypt][Panel] 📥 onRequestFinished:', req.request?.method, req.request?.url);
  if (!req.request || !req.response) return;
  const entry = {
    request: req.request,
    response: {
      status: req.response.status || 0,
      statusText: req.response.statusText || '',
      headers: req.response.headers || [],
      content: {
        size: req.response.content?.size || 0,
        mimeType: req.response.content?.mimeType || '',
        text: '',
        encoding: '',
      },
      bodySize: req.response.bodySize || 0,
    },
    startedDateTime: req.startedDateTime || new Date().toISOString(),
    time: req.time || 0,
    _isLive: true,
    _fromOnRequest: true,
  };
  devtoolsReqs.set(entry, req);
  _pending.push(entry);
  if (!_flushTimer) _flushTimer = setTimeout(flushPending, 400);
});

function flushPending() {
  _flushTimer = null;
  if (!_pending.length) return;
  const start = state.har.log.entries.length;
  for (const e of _pending) state.har.log.entries.push(e);
  _pending = [];
  for (let i = start; i < state.har.log.entries.length; i++) {
    const entry = state.har.log.entries[i];
    state.entryMeta.set(i, {
      method: (entry.request?.method || 'GET').toUpperCase(),
      type: classifyEntry(entry),
      mime: getMimeKey(entry),
      domain: getDomain(entry),
      time: getEntryTime(entry),
    });
    searchIndex.delete(i);
  }
  console.log('[HAR-Decrypt][Panel] flushPending：新增', state.har.log.entries.length - start, '条，累计', state.har.log.entries.length);
  stats.textContent = `实时 · 已抓取 ${state.har.log.entries.length} 条`;
  updateFilterOptions();
  rebuildEntryList();
  if (start === 0 && filterBar.classList.contains('collapsed')) toggleFilterBtn.click();
}

function initFromHAR() {
  if (!chrome.devtools.network.getHAR) return;
  console.log('[HAR-Decrypt][Panel] 调用 getHAR 拉取历史请求…');
  try {
    chrome.devtools.network.getHAR((harLog) => {
      const entries = harLog?.entries || [];
      console.log('[HAR-Decrypt][Panel] getHAR 返回', entries.length, '条历史请求');
      if (!entries.length) return;
      const start = state.har.log.entries.length;
      for (const entry of entries) {
        entry._isLive = true;
        entry._fromGetHAR = true;
        entry._contentFetched = true;
        state.har.log.entries.push(entry);
      }
      for (let i = start; i < state.har.log.entries.length; i++) {
        const e = state.har.log.entries[i];
        state.entryMeta.set(i, {
          method: (e.request?.method || 'GET').toUpperCase(),
          type: classifyEntry(e),
          mime: getMimeKey(e),
          domain: getDomain(e),
          time: getEntryTime(e),
        });
        searchIndex.delete(i);
      }
      updateFilterOptions();
      rebuildEntryList();
      stats.textContent = `实时 · ${state.har.log.entries.length} 条（含 ${entries.length} 条历史）`;
    });
  } catch (e) { console.error('[HAR-Decrypt][Panel] getHAR 出错:', e); }
}
setTimeout(initFromHAR, 500);

// ============================================================
// 清空按钮（两次点击确认，避免 confirm 在部分环境不响应）
// ============================================================
let _clearPending = false;
let _clearTimer = null;

$('clearBtn').addEventListener('click', () => {
  if (!_clearPending) {
    _clearPending = true;
    $('clearBtn').textContent = '⚠️ 再点一次清空';
    $('clearBtn').style.background = 'rgba(185,28,28,.85)';
    $('clearBtn').style.borderColor = 'rgba(239,83,80,.6)';
    clearTimeout(_clearTimer);
    _clearTimer = setTimeout(() => {
      _clearPending = false;
      $('clearBtn').textContent = '🗑️ 清空';
      $('clearBtn').style.background = '';
      $('clearBtn').style.borderColor = '';
    }, 2500);
    return;
  }

  // 第二次点击，执行清空
  _clearPending = false;
  clearTimeout(_clearTimer);
  $('clearBtn').textContent = '🗑️ 清空';
  $('clearBtn').style.background = '';
  $('clearBtn').style.borderColor = '';

  state.har.log.entries.length = 0;
  state.entries = [];
  state.entryMeta.clear();
  state.decryptState.clear();
  state.marks.clear();
  searchIndex.clear();
  _lastFilterCounts = null;   // 关键：重置过滤缓存，让按钮组刷新
  state.currentIndex = -1;
  state.renderedCount = 0;

  // 清空过滤 tag
  ['method', 'type', 'mime', 'domain'].forEach(k => {
    const g = document.getElementById(k + 'Group');
    if (g) {
      g.querySelectorAll('.tag-btn').forEach(b => {
        if (b.dataset.value === '__ALL__') {
          b.classList.add('active');
          b.classList.remove('include', 'exclude');
        } else {
          b.remove();
        }
      });
    }
  });

  entryList.innerHTML = '<div style="padding:24px;text-align:center;color:rgba(255,255,255,.35);">已清空，继续监听新请求…</div>';
  detailPanel.innerHTML = '<div class="empty">点击左侧请求查看并解密</div>';
  stats.textContent = '已清空';
  showToast('已清空', 'ok');
  console.log('[HAR-Decrypt][Panel] 已清空所有请求');
});

// ================================================================
// 过滤选项
// ================================================================
let _lastFilterCounts = null;
function updateFilterOptions() {
  const counts = { method: new Map(), type: new Map(), mime: new Map(), domain: new Map() };
  state.entryMeta.forEach(meta => {
    counts.method.set(meta.method, (counts.method.get(meta.method) || 0) + 1);
    counts.type.set(meta.type, (counts.type.get(meta.type) || 0) + 1);
    counts.mime.set(meta.mime, (counts.mime.get(meta.mime) || 0) + 1);
    counts.domain.set(meta.domain, (counts.domain.get(meta.domain) || 0) + 1);
  });
  const sig = JSON.stringify({
    m: [...counts.method.entries()].sort(), t: [...counts.type.entries()].sort(),
    mm: [...counts.mime.entries()].sort(), d: [...counts.domain.entries()].sort(),
  });
  if (sig === _lastFilterCounts) return;
  _lastFilterCounts = sig;

  const render = (gid, items, currentFilter) => {
    const g = document.getElementById(gid);
    const prev = new Map();
    g.querySelectorAll('.tag-btn').forEach(b => { if (b.dataset.value !== '__ALL__') prev.set(b.dataset.value, b); });
    items.forEach(([v, c]) => {
      const b = prev.get(v);
      if (b) { b.textContent = `${gid === 'typeGroup' ? (TYPE_LABELS[v] || v) : v} (${c})`; prev.delete(v); }
    });
    prev.forEach(b => b.remove());
    const existing = new Set(Array.from(g.querySelectorAll('.tag-btn')).map(b => b.dataset.value));
    items.forEach(([v, c]) => {
      if (existing.has(v)) return;
      const b = document.createElement('button');
      b.className = 'tag-btn'; b.dataset.value = v;
      b.textContent = `${gid === 'typeGroup' ? (TYPE_LABELS[v] || v) : v} (${c})`;
      if (currentFilter.include.has(v)) b.classList.add('include');
      else if (currentFilter.exclude.has(v)) b.classList.add('exclude');
      g.appendChild(b);
    });
    const all = g.querySelector('.tag-btn[data-value="__ALL__"]');
    if (all) all.classList.toggle('active', currentFilter.include.size === 0 && currentFilter.exclude.size === 0);
  };
  render('methodGroup', [...counts.method.entries()].sort((a, b) => a[0].localeCompare(b[0])), state.filters.method);
  render('typeGroup', [...counts.type.entries()].sort((a, b) => b[1] - a[1]), state.filters.type);
  render('mimeGroup', [...counts.mime.entries()].sort((a, b) => b[1] - a[1]), state.filters.mime);
  render('domainGroup', [...counts.domain.entries()].sort((a, b) => b[1] - a[1]), state.filters.domain);
}

['methodGroup', 'typeGroup', 'mimeGroup', 'domainGroup'].forEach(gid => {
  const g = document.getElementById(gid);
  const all = document.createElement('button');
  all.className = 'tag-btn all-btn active';
  all.dataset.value = '__ALL__';
  all.textContent = '全部';
  g.appendChild(all);
});

function handleGroupClick(e, key) {
  const btn = e.target.closest('.tag-btn'); if (!btn) return;
  const group = btn.parentElement; const v = btn.dataset.value; const f = state.filters[key];
  if (v === '__ALL__') { f.include.clear(); f.exclude.clear(); }
  else if (f.include.has(v)) { f.include.delete(v); f.exclude.add(v); }
  else if (f.exclude.has(v)) { f.exclude.delete(v); }
  else { f.include.add(v); }
  group.querySelectorAll('.tag-btn').forEach(b => {
    const vv = b.dataset.value;
    b.classList.remove('include', 'exclude', 'active');
    if (vv === '__ALL__') { if (!f.include.size && !f.exclude.size) b.classList.add('active'); }
    else if (f.include.has(vv)) b.classList.add('include');
    else if (f.exclude.has(vv)) b.classList.add('exclude');
  });
  rebuildEntryList();
}
$('methodGroup').addEventListener('click', (e) => handleGroupClick(e, 'method'));
$('typeGroup').addEventListener('click', (e) => handleGroupClick(e, 'type'));
$('mimeGroup').addEventListener('click', (e) => handleGroupClick(e, 'mime'));
$('domainGroup').addEventListener('click', (e) => handleGroupClick(e, 'domain'));

function resetAllFilters() {
  Object.values(state.filters).forEach(f => { f.include.clear(); f.exclude.clear(); });
  ['method', 'type', 'mime', 'domain'].forEach(k => {
    document.getElementById(k + 'Group').querySelectorAll('.tag-btn').forEach(b => {
      b.classList.remove('include', 'exclude', 'active');
      if (b.dataset.value === '__ALL__') b.classList.add('active');
    });
  });
  searchInput.value = '';
  searchClearBtn.style.display = 'none';
  searchCount.textContent = '';
  searchCount.className = 'search-count';
}
$('resetFilterBtn').addEventListener('click', () => { resetAllFilters(); rebuildEntryList(); });

toggleFilterBtn.addEventListener('click', () => {
  const collapsed = filterBar.classList.toggle('collapsed');
  toggleFilterBtn.textContent = collapsed ? '🔽 展开过滤' : '🔼 收起过滤';
  toggleFilterBtn.classList.toggle('toggle-active', !collapsed);
});

// 搜索
let _searchTimer = null;
searchInput.addEventListener('input', () => {
  searchClearBtn.style.display = searchInput.value ? 'flex' : 'none';
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => doSearch(), 300);
});
searchClearBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchClearBtn.style.display = 'none';
  searchCount.textContent = '';
  searchCount.className = 'search-count';
  rebuildEntryList();
});
function doSearch() {
  const kw = searchInput.value.trim().toLowerCase();
  if (!kw) { searchCount.textContent = ''; searchCount.className = 'search-count'; rebuildEntryList(); return; }
  rebuildEntryList();
  const count = state.entries.length;
  searchCount.textContent = count > 0 ? `匹配 ${count} 条` : '无匹配';
  searchCount.className = 'search-count' + (count > 0 ? '' : ' empty');
}

// ================================================================
// 过滤 + 渲染
// ================================================================
function matchDim(value, f) {
  if (f.include.size > 0 && !f.include.has(value)) return false;
  if (f.exclude.has(value)) return false;
  return true;
}
function rebuildEntryList() {
  const searchKw = searchInput.value.trim().toLowerCase();
  const filtered = [];
  state.har.log.entries.forEach((entry, idx) => {
    const meta = state.entryMeta.get(idx);
    if (!meta) return;
    if (!matchDim(meta.method, state.filters.method)) return;
    if (!matchDim(meta.type, state.filters.type)) return;
    if (!matchDim(meta.mime, state.filters.mime)) return;
    if (!matchDim(meta.domain, state.filters.domain)) return;
    if (searchKw) {
      const txt = getSearchText(idx, entry);
      if (!txt.includes(searchKw)) return;
    }
    filtered.push({
      entry, originalIndex: idx,
      url: entry.request?.url || '',
      method: meta.method, type: meta.type,
      status: entry.response?.status || 0,
      time: meta.time,
      rule: matchRule(entry.request?.url || ''),
    });
  });
  filtered.sort((a, b) => b.time - a.time);
  state.entries = filtered;
  renderList(true);
  const total = state.har.log.entries.length;
  const shown = filtered.length;
  stats.textContent = shown === total ? `实时 · ${total} 条` : `实时 · ${total} 条 / 显示 ${shown} 条`;
}

function renderList(reset) {
  if (reset) { entryList.innerHTML = ''; state.renderedCount = 0; }
  if (!state.entries.length) {
    entryList.innerHTML = '<div style="padding:24px;text-align:center;color:rgba(255,255,255,.35);">无匹配请求</div>';
    return;
  }
  const start = state.renderedCount;
  const end = Math.min(start + PAGE_SIZE, state.entries.length);
  const frag = document.createDocumentFragment();
  for (let i = start; i < end; i++) frag.appendChild(buildListItem(state.entries[i], i));
  entryList.appendChild(frag);
  state.renderedCount = end;
  let more = document.getElementById('loadMoreTip');
  if (state.renderedCount < state.entries.length) {
    const remain = state.entries.length - state.renderedCount;
    if (!more) {
      more = document.createElement('div');
      more.id = 'loadMoreTip';
      more.style.cssText = 'padding:14px;text-align:center;color:rgba(255,255,255,.5);cursor:pointer;border-top:1px solid rgba(255,255,255,.1);font-size:12px;';
      more.addEventListener('click', () => renderList(false));
      entryList.appendChild(more);
    }
    more.textContent = `已渲染 ${state.renderedCount} / ${state.entries.length}（剩 ${remain} 条）`;
  } else if (more) more.remove();
}

function buildListItem(item, i) {
  const div = document.createElement('div');
  const mark = state.marks.get(item.originalIndex);
  let cls = 'entry';
  if (i === state.currentIndex) cls += ' active';
  if (mark?.color) cls += ' marked-' + mark.color;
  div.className = cls;
  div.dataset.idx = item.originalIndex;
  const sc = item.status >= 200 && item.status < 300 ? 'ok' : item.status >= 400 ? 'err' : '';
  const icon = TYPE_ICONS[item.type] ? TYPE_ICONS[item.type] + ' ' : '';
  const originTag = item.entry._fromGetHAR
    ? '<span class="hist-tag">历史</span>'
    : '<span class="live-tag">LIVE</span>';
  div.innerHTML = `
    <span class="method method-${escapeHtml(item.method)}">${escapeHtml(item.method)}</span>
    <span class="type-tag">${icon}${escapeHtml(TYPE_LABELS[item.type] || item.type)}</span>
    <span class="url" title="${escapeHtml(item.url)}">${escapeHtml(item.url)}</span>
    ${originTag}
    <span class="status ${sc}">${item.status || ''}</span>
    ${mark?.note ? `<div class="entry-note" title="${escapeHtml(mark.note)}">${escapeHtml(mark.note)}</div>` : ''}
  `;

  let pressTimer = null, longPressed = false;
  const startPress = () => {
    longPressed = false; div.classList.add('pressing');
    pressTimer = setTimeout(async () => {
      longPressed = true; div.classList.remove('pressing');
      try {
        const code = await generateFetchCode(item.entry, item.rule);
        await navigator.clipboard.writeText(code);
        showToast('已复制 Node.js 代码', 'ok');
      } catch (err) { showToast('复制失败: ' + err.message, 'err'); }
    }, 600);
  };
  const cancelPress = () => { clearTimeout(pressTimer); div.classList.remove('pressing'); };
  div.addEventListener('mousedown', startPress);
  div.addEventListener('mouseup', cancelPress);
  div.addEventListener('mouseleave', cancelPress);
  div.addEventListener('touchstart', (e) => { e.preventDefault(); startPress(); }, { passive: false });
  div.addEventListener('touchend', cancelPress);
  div.addEventListener('touchcancel', cancelPress);
  div.addEventListener('click', () => {
    if (longPressed) { longPressed = false; return; }
    state.currentIndex = i;
    entryList.querySelectorAll('.entry.active').forEach(el => el.classList.remove('active'));
    div.classList.add('active');
    renderDetail();
  });
  div.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, item);
  });
  return div;
}

entryListAside.addEventListener('scroll', function () {
  if (this.scrollTop + this.clientHeight >= this.scrollHeight - 100) {
    if (state.renderedCount < state.entries.length) renderList(false);
  }
});

function updateItemVisual(origIdx) {
  const el = entryList.querySelector(`.entry[data-idx="${origIdx}"]`);
  if (!el) return;
  const mark = state.marks.get(origIdx);
  el.classList.remove('marked-yellow', 'marked-red', 'marked-green', 'marked-blue', 'marked-purple');
  if (mark?.color) el.classList.add('marked-' + mark.color);
  const oldNote = el.querySelector('.entry-note');
  if (oldNote) oldNote.remove();
  if (mark?.note) {
    const n = document.createElement('div');
    n.className = 'entry-note';
    n.title = mark.note;
    n.textContent = mark.note;
    el.appendChild(n);
  }
}

// 右键菜单
let ctxMenu = null;
function closeContextMenu() { if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; } }
document.addEventListener('click', (e) => { if (ctxMenu && !ctxMenu.contains(e.target)) closeContextMenu(); });
document.addEventListener('scroll', closeContextMenu, true);
window.addEventListener('blur', closeContextMenu);

function showContextMenu(x, y, item) {
  closeContextMenu();
  const origIdx = item.originalIndex; const mark = state.marks.get(origIdx) || {};
  const menu = document.createElement('div'); menu.className = 'context-menu';
  const row = document.createElement('div'); row.className = 'ctx-row';
  const lbl = document.createElement('span'); lbl.className = 'ctx-label'; lbl.textContent = '标记颜色'; row.appendChild(lbl);
  ['yellow', 'red', 'green', 'blue', 'purple'].forEach(c => {
    const dot = document.createElement('button');
    dot.className = 'color-dot color-' + c + (mark.color === c ? ' selected' : '');
    dot.title = c;
    dot.addEventListener('click', () => {
      const m = state.marks.get(origIdx) || {};
      m.color = c; state.marks.set(origIdx, m);
      updateItemVisual(origIdx); closeContextMenu();
    });
    row.appendChild(dot);
  });
  menu.appendChild(row);
  const noteBtn = document.createElement('button'); noteBtn.className = 'ctx-btn';
  noteBtn.textContent = mark.note ? '编辑备注…' : '添加备注…';
  noteBtn.addEventListener('click', () => {
    const cur = state.marks.get(origIdx)?.note || '';
    const note = prompt('输入备注（留空清除）:', cur);
    if (note === null) { closeContextMenu(); return; }
    const m = state.marks.get(origIdx) || {};
    if (note.trim()) m.note = note.trim(); else delete m.note;
    if (!m.color && !m.note) state.marks.delete(origIdx); else state.marks.set(origIdx, m);
    updateItemVisual(origIdx); closeContextMenu();
  });
  menu.appendChild(noteBtn);
  if (mark.color) {
    const b = document.createElement('button'); b.className = 'ctx-btn'; b.textContent = '清除颜色';
    b.addEventListener('click', () => {
      const m = state.marks.get(origIdx);
      if (m) { delete m.color; if (!m.note) state.marks.delete(origIdx); }
      updateItemVisual(origIdx); closeContextMenu();
    });
    menu.appendChild(b);
  }
  if (mark.color || mark.note) {
    const b = document.createElement('button'); b.className = 'ctx-btn danger'; b.textContent = '清除全部标记';
    b.addEventListener('click', () => { state.marks.delete(origIdx); updateItemVisual(origIdx); closeContextMenu(); });
    menu.appendChild(b);
  }
  document.body.appendChild(menu); ctxMenu = menu;
  const rect = menu.getBoundingClientRect();
  let fx = x, fy = y;
  if (rect.right > window.innerWidth - 4) fx = window.innerWidth - rect.width - 4;
  if (rect.bottom > window.innerHeight - 4) fy = window.innerHeight - rect.height - 4;
  menu.style.left = fx + 'px'; menu.style.top = fy + 'px';
}

// ================================================================
// 拉取响应体
// ================================================================
async function ensureContent(entry) {
  if (!entry._isLive) return;
  if (entry._fromGetHAR) { entry._contentFetched = true; return; }
  if (entry._contentFetched) return;
  entry._contentFetched = true;
  const req = devtoolsReqs.get(entry);
  if (!req) { console.warn('[HAR-Decrypt][Panel] 找不到 devtools 请求对象'); return; }
  const size = entry.response?.content?.size || entry.response?.bodySize || 0;
  if (size > MAX_FETCH_SIZE) {
    entry.response.content.text = '';
    entry._contentTooBig = true;
    return;
  }
  console.log('[HAR-Decrypt][Panel] 拉取响应体:', entry.request?.url);
  await new Promise(resolve => {
    const timer = setTimeout(() => { console.warn('[HAR-Decrypt][Panel] getContent 超时'); resolve(); }, 5000);
    try {
      req.getContent((content, encoding) => {
        clearTimeout(timer);
        entry.response.content.text = content || '';
        entry.response.content.encoding = encoding || '';
        console.log('[HAR-Decrypt][Panel] ✅ getContent 返回，长度', (content || '').length);
        resolve();
      });
    } catch (e) {
      clearTimeout(timer);
      console.error('[HAR-Decrypt][Panel] getContent 出错:', e);
      resolve();
    }
  });
}

// ================================================================
// 详情
// ================================================================
async function renderDetail() {
  if (state.currentIndex < 0 || !state.entries[state.currentIndex]) {
    detailPanel.innerHTML = '<div class="empty">点击左侧请求查看并解密</div>';
    return;
  }
  const item = state.entries[state.currentIndex];
  const { entry, originalIndex } = item;

  if (entry._isLive && !entry._contentFetched && !entry._fromGetHAR) {
    detailPanel.innerHTML = '<div class="empty">正在获取响应体…</div>';
    await ensureContent(entry);
  }
  if (entry._fromGetHAR) {
    detailPanel.innerHTML = '<div class="empty" style="padding-top:80px;line-height:1.9;">此请求在面板打开前已存在，DevTools 无法获取它的响应体。<br><br>请刷新页面重新发起该请求。</div>';
    return;
  }
  if (entry._contentTooBig) {
    detailPanel.innerHTML = '<div class="empty">响应体超过 15MB，无法获取。<br>请用 Network 面板右键 → Save all as HAR，再导入 HAR 文件版工具。</div>';
    return;
  }

  const ds = getDecryptState(originalIndex);
  const mark = state.marks.get(originalIndex);
  const rule = matchRule(entry.request?.url || '');
  const type = state.entryMeta.get(originalIndex)?.type || classifyEntry(entry);
  const reqText = entry.request?.postData?.text || '';
  const resText = entry.response?.content?.text || '';
  const isMedia = type === 'image' || type === 'audio' || type === 'video';

  if (!isMedia && !ds.autoRan && (reqText || resText)) {
    ds.autoRan = true; ds.loading = true;
    runDecryptForItem({ entry, originalIndex, url: entry.request?.url || '', rule }, ds).then(() => {
      ds.loading = false;
      if (state.entries[state.currentIndex]?.originalIndex === originalIndex) renderDetail();
    });
  }

  detailPanel.innerHTML = '';
  const info = document.createElement('div');
  info.innerHTML = `
    <div class="field"><label>URL</label><div class="value">${escapeHtml(item.url)}</div></div>
    <div class="field"><label>方法 / 类型 / 状态 / 时间</label><div class="value">
      <span class="method method-${escapeHtml(item.method)}">${escapeHtml(item.method)}</span>
      &nbsp;<span class="tag">${TYPE_ICONS[type] ? TYPE_ICONS[type] + ' ' : ''}${escapeHtml(TYPE_LABELS[type] || type)}</span>
      &nbsp;${entry.response?.status || ''} ${escapeHtml(entry.response?.statusText || '')}
      &nbsp;<span class="tag">${escapeHtml(formatTime(entry.startedDateTime))}</span>
      ${rule ? `&nbsp;<span class="tag" style="background:rgba(217,119,6,.25);color:#ffcc80;">规则: ${escapeHtml(rule.note || String(rule.match))}${rule.keys ? ' · 含密钥' : ''}</span>` : ''}
    </div></div>
    ${mark?.note ? `<div class="field"><label>备注</label><div class="value" style="color:rgba(255,255,255,.65);font-style:italic;">${escapeHtml(mark.note)}</div></div>` : ''}
  `;
  detailPanel.appendChild(info);

  if (reqText) {
    detailPanel.appendChild(buildBodySection({
      title: '请求体', originalText: reqText, encoding: entry.request.postData.encoding || '',
      decoderId: ds.reqDecoder || rule?.reqDecoder || 'raw',
      result: ds.reqResult, error: ds.reqError, loading: ds.loading,
      onDecrypt: async (id) => {
        try { const b = harTextToBytes(reqText, entry.request.postData.encoding || ''); ds.reqDecoder = id; ds.reqResult = await runDecoder(id, b, { rule, keys: rule?.keys || {} }); ds.reqError = null; }
        catch (err) { ds.reqDecoder = id; ds.reqResult = null; ds.reqError = err.message || String(err); }
        renderDetail();
      },
    }));
  } else {
    const params = extractRequestParams(entry);
    if (params) detailPanel.appendChild(buildParamsSection(params.title, params.obj));
    else detailPanel.appendChild(buildEmptySection('请求体', '（无请求体，且 URL 中无查询参数）'));
  }

  if (isMedia) {
    const media = buildMediaElement(entry, type);
    if (media) {
      const t = document.createElement('div'); t.className = 'section-title'; t.textContent = `响应体（${TYPE_LABELS[type]}预览）`;
      detailPanel.appendChild(t); detailPanel.appendChild(media);
      if (resText) {
        const det = document.createElement('details'); det.className = 'original-block';
        const sum = document.createElement('summary'); sum.textContent = `原始内容（${resText.length} 字符）`;
        det.appendChild(sum);
        const pre = document.createElement('pre');
        pre.textContent = resText.length > 2000 ? resText.slice(0, 2000) + '\n…（已截断）' : resText;
        det.appendChild(pre); detailPanel.appendChild(det);
      }
    } else {
      detailPanel.appendChild(buildBodySection({
        title: '响应体', originalText: resText, encoding: entry.response?.content?.encoding || '',
        decoderId: 'raw', result: null, error: null, loading: false, onDecrypt: async () => {},
      }));
    }
  } else {
    detailPanel.appendChild(buildBodySection({
      title: '响应体', originalText: resText, encoding: entry.response?.content?.encoding || '',
      decoderId: ds.resDecoder || rule?.resDecoder || 'raw',
      result: ds.resResult, error: ds.resError, loading: ds.loading,
      onDecrypt: async (id) => {
        try { const b = harTextToBytes(resText, entry.response.content.encoding || ''); ds.resDecoder = id; ds.resResult = await runDecoder(id, b, { rule, keys: rule?.keys || {} }); ds.resError = null; }
        catch (err) { ds.resDecoder = id; ds.resResult = null; ds.resError = err.message || String(err); }
        renderDetail();
      },
    }));
  }
}

function extractRequestParams(entry) {
  const hp = entry.request.postData?.params;
  if (hp?.length) { const o = {}; hp.forEach(p => o[p.name] = p.value); return { title: '请求参数（postData.params）', obj: o }; }
  try { const u = new URL(entry.request.url); const o = {}; u.searchParams.forEach((v, k) => { o[k] = v; }); if (Object.keys(o).length) return { title: '请求参数（URL Query）', obj: o }; } catch {}
  return null;
}
function buildParamsSection(title, obj) {
  const w = document.createElement('div');
  const t = document.createElement('div'); t.className = 'section-title'; t.textContent = title; w.appendChild(t);
  w.appendChild(renderJsonWithTs(obj));
  const btn = document.createElement('button'); btn.textContent = '复制原始 JSON';
  btn.style.cssText = 'margin-top:8px;padding:5px 12px;border:1px solid rgba(90,170,230,.5);background:rgba(14,99,156,.3);color:#9ad0ff;border-radius:5px;cursor:pointer;font-size:12px;font-family:inherit;';
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(obj, null, 2)); btn.textContent = '已复制'; setTimeout(() => btn.textContent = '复制原始 JSON', 1500); }
    catch { btn.textContent = '复制失败'; }
  });
  w.appendChild(btn);
  return w;
}
function buildEmptySection(title, text) {
  const w = document.createElement('div');
  const t = document.createElement('div'); t.className = 'section-title'; t.textContent = title; w.appendChild(t);
  const pre = document.createElement('pre'); pre.className = 'empty'; pre.textContent = text; w.appendChild(pre);
  return w;
}
function buildBodySection({ title, originalText, encoding, decoderId, result, error, loading, onDecrypt }) {
  const w = document.createElement('div');
  const t = document.createElement('div'); t.className = 'section-title'; t.textContent = title + (originalText ? '' : '（无内容）'); w.appendChild(t);
  if (!originalText) {
    const p = document.createElement('pre'); p.className = 'empty'; p.textContent = '（无内容）'; w.appendChild(p); return w;
  }
  const tb = document.createElement('div'); tb.className = 'toolbar';
  const sel = document.createElement('select');
  const all = getAllDecoders();
  for (const [id, d] of Object.entries(all)) {
    const o = document.createElement('option'); o.value = id; o.textContent = d.label;
    if (id === decoderId) o.selected = true; sel.appendChild(o);
  }
  sel.addEventListener('change', () => onDecrypt(sel.value));
  tb.appendChild(sel);
  if (encoding) { const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = `编码: ${encoding}`; tb.appendChild(tag); }
  w.appendChild(tb);
  const det = document.createElement('details'); det.className = 'original-block';
  const sum = document.createElement('summary'); sum.textContent = `原始内容（${originalText.length} 字符，点击展开）`;
  det.appendChild(sum);
  const origPre = document.createElement('pre');
  origPre.textContent = originalText.length > 5000 ? originalText.slice(0, 5000) + '\n…（已截断）' : originalText;
  det.appendChild(origPre); w.appendChild(det);
  const rl = document.createElement('div'); rl.className = 'label-mini'; rl.textContent = '解析结果:'; w.appendChild(rl);
  if (loading) { const p = document.createElement('pre'); p.className = 'loading'; p.textContent = '正在自动解密…'; w.appendChild(p); }
  else if (error) { const p = document.createElement('pre'); p.className = 'err'; p.textContent = error; w.appendChild(p); }
  else if (result === null || result === undefined) { const p = document.createElement('pre'); p.className = 'empty'; p.textContent = '（无结果，可切换下拉框重试）'; w.appendChild(p); }
  else {
    const isObj = result !== null && typeof result === 'object' && !(result instanceof Uint8Array) && !(result instanceof ArrayBuffer);
    if (isObj) {
      w.appendChild(renderJsonWithTs(result));
      const copyBtn = document.createElement('button'); copyBtn.textContent = '复制原始 JSON';
      copyBtn.style.cssText = 'margin-top:8px;padding:5px 12px;border:1px solid rgba(90,170,230,.5);background:rgba(14,99,156,.3);color:#9ad0ff;border-radius:5px;cursor:pointer;font-size:12px;font-family:inherit;';
      copyBtn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(JSON.stringify(result, null, 2)); copyBtn.textContent = '已复制'; setTimeout(() => copyBtn.textContent = '复制原始 JSON', 1500); }
        catch { copyBtn.textContent = '复制失败'; }
      });
      w.appendChild(copyBtn);
    } else {
      const disp = bytesToDisplay(result);
      const pre = document.createElement('pre'); pre.textContent = disp.text; w.appendChild(pre);
      const copyBtn = document.createElement('button'); copyBtn.textContent = '复制结果';
      copyBtn.style.cssText = 'margin-top:8px;padding:5px 12px;border:1px solid rgba(90,170,230,.5);background:rgba(14,99,156,.3);color:#9ad0ff;border-radius:5px;cursor:pointer;font-size:12px;font-family:inherit;';
      copyBtn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(disp.text); copyBtn.textContent = '已复制'; setTimeout(() => copyBtn.textContent = '复制结果', 1500); }
        catch { copyBtn.textContent = '复制失败'; }
      });
      w.appendChild(copyBtn);
    }
  }
  return w;
}

function buildMediaElement(entry, type) {
  const c = entry.response?.content; if (!c?.text) return null;
  const b64 = c.encoding === 'base64' ? c.text : bytesToBase64(harTextToBytes(c.text, c.encoding || ''));
  const mime = getMimeKey(entry) === '(无 MIME)' ? guessMimeFromUrl(entry.request.url) : getMimeKey(entry);
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="media-meta">预览 · ${escapeHtml(mime)}</div>`;
  const box = document.createElement('div'); box.className = 'media-preview';
  if (type === 'image') { const img = document.createElement('img'); img.src = `data:${mime};base64,${b64}`; img.onerror = () => box.textContent = '⚠ 图片加载失败'; box.appendChild(img); }
  else if (type === 'audio') { const a = document.createElement('audio'); a.controls = true; a.src = `data:${mime};base64,${b64}`; a.onerror = () => box.textContent = '⚠ 音频加载失败'; box.appendChild(a); }
  else if (type === 'video') { const v = document.createElement('video'); v.controls = true; v.src = `data:${mime};base64,${b64}`; v.onerror = () => box.textContent = '⚠ 视频加载失败'; box.appendChild(v); }
  else return null;
  wrap.appendChild(box); return wrap;
}
function guessMimeFromUrl(url) {
  const ext = (url.toLowerCase().split('?')[0].match(/\.([a-z0-9]+)$/) || [])[1];
  const map = { png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',svg:'image/svg+xml',ico:'image/x-icon',bmp:'image/bmp',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',m4a:'audio/mp4',flac:'audio/flac',aac:'audio/aac',mp4:'video/mp4',webm:'video/webm',mkv:'video/x-matroska' };
  return map[ext] || 'application/octet-stream';
}

// ================================================================
// 解密执行
// ================================================================
async function runDecoder(id, bytes, ctx) {
  const d = getAllDecoders()[id];
  if (!d) throw new Error('未知解码方式: ' + id);
  return await d.run(bytes, ctx);
}
async function runDecryptForItem(item, ds) {
  const { entry, rule } = item;
  const reqId = ds.reqDecoder || rule?.reqDecoder || 'raw';
  const resId = ds.resDecoder || rule?.resDecoder || 'raw';
  ds.reqDecoder = reqId; ds.resDecoder = resId;
  const reqSize = entry.request?.bodySize || 0;
  const resSize = entry.response?.content?.size || 0;
  const ctx = { rule, keys: rule?.keys || {} };
  const jobs = [];
  const rt = entry.request?.postData?.text;
  if (rt) {
    if (reqSize > MAX_AUTO_DECRYPT) { ds.reqError = `请求体过大 (${(reqSize/1024/1024).toFixed(1)}MB)`; ds.reqResult = null; }
    else jobs.push((async () => {
      try { const b = harTextToBytes(rt, entry.request.postData.encoding || ''); ds.reqResult = await runDecoder(reqId, b, ctx); ds.reqError = null; }
      catch (e) { ds.reqError = e.message || String(e); ds.reqResult = null; }
    })());
  }
  const st = entry.response?.content?.text;
  if (st) {
    if (resSize > MAX_AUTO_DECRYPT) { ds.resError = `响应体过大 (${(resSize/1024/1024).toFixed(1)}MB)`; ds.resResult = null; }
    else jobs.push((async () => {
      try { const b = harTextToBytes(st, entry.response.content.encoding || ''); ds.resResult = await runDecoder(resId, b, ctx); ds.resError = null; }
      catch (e) { ds.resError = e.message || String(e); ds.resResult = null; }
    })());
  }
  await Promise.all(jobs);
}
function getDecryptState(i) {
  if (!state.decryptState.has(i)) state.decryptState.set(i, { reqDecoder: '', reqResult: null, reqError: null, resDecoder: '', resResult: null, resError: null, autoRan: false, loading: false });
  return state.decryptState.get(i);
}

// 批量解密
autoAllBtn.addEventListener('click', async () => {
  if (!state.entries.length) return;
  autoAllBtn.disabled = true; autoAllBtn.textContent = '⏳ 处理中…';
  let total = 0;
  for (let i = 0; i < state.entries.length; i++) {
    const item = state.entries[i];
    if (!item.rule) continue;
    const entry = item.entry;
    if (entry._isLive && !entry._contentFetched && !entry._fromGetHAR) await ensureContent(entry);
    if (!entry.response?.content?.text) continue;
    total++;
    const ds = getDecryptState(item.originalIndex);
    ds.autoRan = true;
    await runDecryptForItem(item, ds);
  }
  renderDetail();
  autoAllBtn.textContent = '🔓 批量解密'; autoAllBtn.disabled = false;
  showToast(`已处理 ${total} 条`, 'ok');
});

// 导出
exportBtn.addEventListener('click', async () => {
  if (!state.entries.length) { showToast('当前无请求可导出', 'err'); return; }
  exportBtn.disabled = true; const oldText = exportBtn.textContent;
  exportBtn.textContent = '⏳ 拉取中…';
  for (const item of state.entries) {
    const entry = item.entry;
    if (entry._isLive && !entry._contentFetched && !entry._fromGetHAR) await ensureContent(entry);
  }
  const outHar = {
    log: {
      version: '1.2',
      creator: { name: 'HAR 解密 - DevTools', version: '1.0.2' },
      entries: state.entries.map(e => {
        const entry = JSON.parse(JSON.stringify(e.entry));
        delete entry._isLive;
        delete entry._contentFetched;
        delete entry._contentTooBig;
        delete entry._fromOnRequest;
        delete entry._fromGetHAR;
        return entry;
      }),
    },
  };
  state.entries.forEach((item, i) => {
    const ds = state.decryptState.get(item.originalIndex);
    if (!ds) return;
    const outEntry = outHar.log.entries[i];
    if (ds.reqResult != null && outEntry.request?.postData) writeResultBack(outEntry.request.postData, ds.reqResult);
    if (ds.resResult != null && outEntry.response?.content) writeResultBack(outEntry.response.content, ds.resResult);
  });
  const blob = new Blob([JSON.stringify(outHar, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `devtools-${Date.now()}.har`;
  a.click(); URL.revokeObjectURL(a.href);
  exportBtn.textContent = oldText; exportBtn.disabled = false;
  showToast('已导出', 'ok');
});
function writeResultBack(c, r) {
  if (typeof r === 'string') { c.text = r; delete c.encoding; c.mimeType = 'application/json'; }
  else if (r instanceof Uint8Array) { c.text = bytesToBase64(r); c.encoding = 'base64'; }
  else if (r instanceof ArrayBuffer) { c.text = bytesToBase64(new Uint8Array(r)); c.encoding = 'base64'; }
  else { c.text = JSON.stringify(r, null, 2); delete c.encoding; c.mimeType = 'application/json'; }
  if ('size' in c) c.size = new Blob([c.text]).size;
}

// fetch 生成
function extractRequestInfo(entry) {
  const method = (entry.request.method || 'GET').toUpperCase();
  const fullUrl = entry.request.url; const u = new URL(fullUrl);
  const queryParams = {}; u.searchParams.forEach((v, k) => { queryParams[k] = v; });
  const bodyText = entry.request.postData?.text || '';
  let bodyParams = null;
  if (bodyText) {
    const t = bodyText.trim();
    if (t.startsWith('{') || t.startsWith('[')) { try { bodyParams = JSON.parse(t); } catch {} }
    if (!bodyParams) { const f = tryParseForm(bodyText); if (f) bodyParams = f; }
  }
  const headers = {}; (entry.request.headers || []).forEach(h => { headers[h.name] = h.value; });
  return { method, fullUrl, u, queryParams, bodyText, bodyParams, headers };
}
async function generateFetchCode(entry, rule) {
  const { method, fullUrl, u, queryParams, bodyText, bodyParams, headers } = extractRequestInfo(entry);
  const baseUrl = u.origin + u.pathname;
  const hasQuery = Object.keys(queryParams).length > 0;
  const hasBody = !!bodyText;
  const needPako = rule && rule.resDecoder && (['gzipFix','gunzip','inflate'].includes(rule.resDecoder) || ((sessionDecoders[rule.resDecoder] || fileDecoders[rule.resDecoder])?.code || '').includes('pako'));
  const forbidden = /^(host|content-length|connection|transfer-encoding|upgrade|keep-alive|expect|proxy-)/i;
  const cleanHeaders = {};
  for (const [k, v] of Object.entries(headers)) if (!forbidden.test(k)) cleanHeaders[k] = v;
  const L = [];
  L.push(`// 来源: ${method} ${fullUrl}`);
  L.push('// Node.js 18+');
  if (needPako) L.push('// 依赖: npm install pako');
  L.push('');
  if (needPako) { L.push(`const pako = require('pako');`); L.push(''); }
  L.push('(async () => {');
  if (hasQuery) { L.push(`  const queryParams = ${JSON.stringify(queryParams, null, 2).split('\n').join('\n  ')};`); L.push(''); }
  if (hasBody) {
    if (bodyParams) L.push(`  const bodyParams = ${JSON.stringify(bodyParams, null, 2).split('\n').join('\n  ')};`);
    else L.push(`  const rawBody = ${JSON.stringify(bodyText)};`);
    L.push('');
  }
  if (hasQuery) {
    L.push(`  const query = Object.entries(queryParams).map(([k, v]) => \`\${encodeURIComponent(k)}=\${encodeURIComponent(v)}\`).join('&');`);
    L.push(`  const url = '${baseUrl}' + (query ? '?' + query : '');`);
  } else L.push(`  const url = '${baseUrl}';`);
  L.push('');
  L.push(`  const headers = ${JSON.stringify(cleanHeaders, null, 2).split('\n').join('\n  ')};`);
  L.push('');
  const opts = [`    method: '${method}'`, `    headers`];
  if (hasBody) opts.push(bodyParams ? `    body: JSON.stringify(bodyParams)` : `    body: rawBody`);
  L.push(`  const res = await fetch(url, {\n${opts.join(',\n')}\n  });`);
  L.push(`  if (!res.ok) throw new Error(\`HTTP \${res.status}\`);`);
  const useRule = rule && rule.resDecoder && rule.resDecoder !== 'raw';
  if (useRule) {
    const id = rule.resDecoder;
    const custom = sessionDecoders[id] || fileDecoders[id];
    if (custom) {
      L.push(`  const _decryptFn = ${custom.code.split('\n').join('\n  ')};`);
      const keysStr = rule.keys ? JSON.stringify(rule.keys, null, 2).split('\n').join('\n  ') : '{}';
      L.push(`  const _ctx = { keys: ${keysStr} };`);
      L.push(`  const buf = await res.arrayBuffer();`);
      L.push(`  const data = await _decryptFn(new Uint8Array(buf), _ctx);`);
    } else {
      L.push(`  const buf = await res.arrayBuffer();`);
      L.push(`  const _bytes = new Uint8Array(buf);`);
      if (id === 'gzipFix') {
        L.push(`  const t = new Uint8Array(_bytes); t[0]=0x1f;t[1]=0x8b;t[2]=0x08;t[3]=0x00;t[4]=0;t[5]=0;t[6]=0;t[7]=0;`);
        L.push(`  const data = JSON.parse(new TextDecoder().decode(pako.ungzip(t)));`);
      } else if (id === 'gunzip') {
        L.push(`  const data = JSON.parse(new TextDecoder().decode(pako.ungzip(_bytes)));`);
      } else { L.push(`  const data = _bytes;`); }
    }
  } else {
    L.push(`  let data;`);
    L.push(`  try { data = await res.clone().json(); } catch { try { data = await res.clone().text(); } catch { data = await res.arrayBuffer(); } }`);
  }
  L.push(`  console.log(data);`);
  L.push(`})().catch(err => { console.error(err); process.exit(1); });`);
  return L.join('\n');
}

// ================================================================
// 配置模态框
// ================================================================
const configModal = $('configModal'), modalCloseBtn = $('modalCloseBtn');
const addDecoderBtn = $('addDecoderBtn'), addRuleBtn = $('addRuleBtn');
const decoderList = $('decoderList'), ruleList = $('ruleList');
const decoderForm = $('decoderForm'), ruleForm = $('ruleForm');
const decoderFormError = $('decoderFormError'), ruleFormError = $('ruleFormError');
const decoderIdInput = $('decoderIdInput'), decoderLabelInput = $('decoderLabelInput');
const decoderCdnInput = $('decoderCdnInput'), decoderCodeInput = $('decoderCodeInput');
const decoderTemplateSelect = $('decoderTemplateSelect');
const saveDecoderBtn = $('saveDecoderBtn'), cancelDecoderBtn = $('cancelDecoderBtn');
const rulePatternInput = $('rulePatternInput'), ruleTypeSelect = $('ruleTypeSelect');
const ruleReqDecoderSelect = $('ruleReqDecoderSelect'), ruleResDecoderSelect = $('ruleResDecoderSelect');
const ruleKeysInput = $('ruleKeysInput');
const saveRuleBtn = $('saveRuleBtn'), cancelRuleBtn = $('cancelRuleBtn');
const exportOutput = $('exportOutput');

let editingDecoderId = null, editingRuleIndex = -1;

function openModal() { configModal.style.display = 'flex'; switchTab('decoders'); renderDecoderList(); renderRuleList(); hideDecoderForm(); hideRuleForm(); fillDecoderSelects(); fillTemplateSelect(); }
function closeModal() { configModal.style.display = 'none'; }
$('configBtn').addEventListener('click', openModal);
modalCloseBtn.addEventListener('click', closeModal);
configModal.addEventListener('click', (e) => { if (e.target === configModal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && configModal.style.display === 'flex') closeModal(); });

document.querySelectorAll('.modal-tab').forEach(tab => { tab.addEventListener('click', () => switchTab(tab.dataset.tab)); });
function switchTab(name) {
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === name));
  if (name === 'rules') fillDecoderSelects();
}

function fillTemplateSelect() {
  const cur = decoderTemplateSelect.value;
  decoderTemplateSelect.innerHTML = '<option value="">-- 手动填写 --</option>';
  const templates = window.HAR_TEMPLATES || {};
  for (const [id, t] of Object.entries(templates)) {
    const o = document.createElement('option'); o.value = id; o.textContent = t.label || id;
    decoderTemplateSelect.appendChild(o);
  }
  decoderTemplateSelect.value = cur;
}
decoderTemplateSelect.addEventListener('change', (e) => {
  const id = e.target.value; if (!id) return;
  const t = (window.HAR_TEMPLATES || {})[id]; if (!t) return;
  decoderCodeInput.value = t.code;
  if (!decoderLabelInput.value.trim()) decoderLabelInput.value = t.label || id;
});

function reloadFiles() {
  const s1 = document.createElement('script'); s1.src = './decoders.js?' + Date.now();
  const s2 = document.createElement('script'); s2.src = './rules.js?' + Date.now();
  s1.onload = () => { document.head.appendChild(s2); s2.onload = () => { refreshFileData(); renderDecoderList(); renderRuleList(); fillDecoderSelects(); fillTemplateSelect(); if (state.har.log.entries.length) rebuildEntryList(); showToast('文件已重载', 'ok'); }; };
  document.head.appendChild(s1);
}
$('reloadFilesBtn').addEventListener('click', reloadFiles);
$('reloadFilesBtn2').addEventListener('click', reloadFiles);

function renderDecoderList() {
  decoderList.innerHTML = '';
  const fileIds = Object.keys(fileDecoders);
  const sessionIds = Object.keys(sessionDecoders).filter(id => !fileDecoders[id]);
  if (!fileIds.length && !sessionIds.length) {
    const e = document.createElement('div'); e.className = 'config-empty';
    e.textContent = 'decoders.js 中暂无算法。'; decoderList.appendChild(e); return;
  }
  const makeItem = (id, src) => {
    const d = src === 'file' ? fileDecoders[id] : sessionDecoders[id];
    const item = document.createElement('div'); item.className = 'config-item';
    const comp = getCompiledCustom(id);
    const errTag = comp.error ? `<span class="badge-error">编译错误</span>` : '';
    const cdnCount = (d.cdn || []).length;
    const cdnTag = cdnCount ? `<span class="badge-file" style="background:rgba(255,152,0,.2);color:#ffcc80;">CDN ×${cdnCount}</span>` : '';
    const srcTag = src === 'file' ? '<span class="badge-file">文件</span>' : '<span class="badge-session">会话</span>';
    const preview = (d.code || '').split('\n')[0].slice(0, 80);
    item.innerHTML = `
      <div class="config-item-main">
        <div class="config-item-title">${escapeHtml(d.label)} <span class="config-item-id">${escapeHtml(id)}</span>${srcTag}${errTag}${cdnTag}</div>
        <div class="config-item-preview">${escapeHtml(preview)}${d.code?.includes('\n') ? '…' : ''}</div>
      </div>
      ${src === 'session' ? `<div class="config-item-actions">
        <button data-action="edit">编辑</button><button data-action="delete" class="danger">删除</button>
      </div>` : ''}
    `;
    if (src === 'session') {
      item.querySelector('[data-action="edit"]').addEventListener('click', () => editDecoder(id));
      item.querySelector('[data-action="delete"]').addEventListener('click', () => deleteDecoder(id));
    }
    decoderList.appendChild(item);
  };
  fileIds.forEach(id => makeItem(id, 'file'));
  sessionIds.forEach(id => makeItem(id, 'session'));
}
function editDecoder(id) {
  editingDecoderId = id;
  const d = sessionDecoders[id];
  decoderIdInput.value = id; decoderIdInput.disabled = true;
  decoderLabelInput.value = d.label || '';
  decoderCdnInput.value = (d.cdn || []).join(', ');
  decoderCodeInput.value = d.code || '';
  fillTemplateSelect();
  decoderFormError.style.display = 'none'; decoderForm.style.display = 'block';
  addDecoderBtn.style.display = 'none';
}
function deleteDecoder(id) {
  if (!confirm(`删除会话内算法「${id}」？`)) return;
  delete sessionDecoders[id]; _compiledFns.delete(id); renderDecoderList(); refreshAll();
}
function hideDecoderForm() {
  decoderForm.style.display = 'none'; decoderIdInput.disabled = false;
  editingDecoderId = null; addDecoderBtn.style.display = ''; decoderFormError.style.display = 'none';
}
function showDecoderError(msg) { decoderFormError.textContent = msg; decoderFormError.style.display = 'block'; }

addDecoderBtn.addEventListener('click', () => {
  editingDecoderId = null;
  decoderIdInput.value = ''; decoderIdInput.disabled = false;
  decoderLabelInput.value = ''; decoderCdnInput.value = ''; decoderCodeInput.value = '';
  fillTemplateSelect(); decoderTemplateSelect.value = '';
  decoderFormError.style.display = 'none'; decoderForm.style.display = 'block';
  addDecoderBtn.style.display = 'none'; decoderIdInput.focus();
});
cancelDecoderBtn.addEventListener('click', hideDecoderForm);

saveDecoderBtn.addEventListener('click', () => {
  const id = decoderIdInput.value.trim();
  const label = decoderLabelInput.value.trim();
  const cdn = decoderCdnInput.value.split(',').map(s => s.trim()).filter(Boolean);
  const code = decoderCodeInput.value;
  if (!id) return showDecoderError('请填写 ID');
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(id)) return showDecoderError('ID 必须是合法 JS 标识符');
  if (!editingDecoderId && (BUILTIN_DECODERS[id] || fileDecoders[id] || sessionDecoders[id])) return showDecoderError(`"${id}" 已存在`);
  if (!label) return showDecoderError('请填写名称');
  if (!code.trim()) return showDecoderError('请填写代码');
  const comp = compileDecoderCode(code);
  if (comp.error) return showDecoderError('代码编译失败：\n' + comp.error);
  if (cdn.length) {
    return showDecoderError('MV3 扩展 CSP 禁止加载远程 CDN。\n请把依赖文件放到扩展目录，在 decoders.js 中直接引用（如 pako 已内置）。');
  }
  sessionDecoders[id] = { label, code, cdn };
  _compiledFns.delete(id);
  renderDecoderList(); hideDecoderForm(); refreshAll();
  showToast(`会话算法「${label}」已添加`, 'ok');
});

function renderRuleList() {
  ruleList.innerHTML = '';
  const hasAny = fileRules.length || sessionRules.length;
  if (!hasAny) {
    const e = document.createElement('div'); e.className = 'config-empty';
    e.textContent = 'rules.js 中暂无规则。'; ruleList.appendChild(e); return;
  }
  const makeItem = (r, idx, src) => {
    const item = document.createElement('div'); item.className = 'config-item';
    const typeLabel = r.isRegex ? '正则' : '包含';
    const srcTag = src === 'file' ? '<span class="badge-file">文件</span>' : '<span class="badge-session">会话</span>';
    const keysTag = r.keys ? '<span class="badge-keys">含密钥</span>' : '';
    item.innerHTML = `
      <div class="config-item-main">
        <div class="config-item-title">${escapeHtml(r.pattern)} <span class="config-item-id">${escapeHtml(typeLabel)}</span>${srcTag}${keysTag}</div>
        <div class="config-item-preview">请求: <code>${escapeHtml(r.reqDecoder)}</code> · 响应: <code>${escapeHtml(r.resDecoder)}</code></div>
      </div>
      ${src === 'session' ? `<div class="config-item-actions">
        <button data-action="edit">编辑</button><button data-action="delete" class="danger">删除</button>
      </div>` : ''}
    `;
    if (src === 'session') {
      item.querySelector('[data-action="edit"]').addEventListener('click', () => editRule(idx));
      item.querySelector('[data-action="delete"]').addEventListener('click', () => deleteRule(idx));
    }
    ruleList.appendChild(item);
  };
  fileRules.forEach(r => makeItem(r, -1, 'file'));
  sessionRules.forEach((r, i) => makeItem(r, i, 'session'));
}
function editRule(idx) {
  editingRuleIndex = idx;
  const r = sessionRules[idx];
  rulePatternInput.value = r.pattern;
  ruleTypeSelect.value = r.isRegex ? 'regex' : 'string';
  fillDecoderSelects();
  ruleReqDecoderSelect.value = r.reqDecoder || 'raw';
  ruleResDecoderSelect.value = r.resDecoder || 'raw';
  ruleKeysInput.value = r.keys ? JSON.stringify(r.keys, null, 2) : '';
  ruleFormError.style.display = 'none'; ruleForm.style.display = 'block';
  addRuleBtn.style.display = 'none';
}
function deleteRule(idx) {
  if (!confirm('删除此会话规则？')) return;
  sessionRules.splice(idx, 1); renderRuleList();
  if (state.har.log.entries.length) rebuildEntryList();
}
function hideRuleForm() { ruleForm.style.display = 'none'; editingRuleIndex = -1; addRuleBtn.style.display = ''; ruleFormError.style.display = 'none'; }
function showRuleError(msg) { ruleFormError.textContent = msg; ruleFormError.style.display = 'block'; }

function fillDecoderSelects() {
  const all = getAllDecoders();
  const fill = (sel, cur) => {
    sel.innerHTML = '';
    for (const [id, d] of Object.entries(all)) {
      const o = document.createElement('option'); o.value = id; o.textContent = d.label;
      if (id === cur) o.selected = true; sel.appendChild(o);
    }
  };
  const rq = ruleReqDecoderSelect.value || 'raw'; const rs = ruleResDecoderSelect.value || 'raw';
  fill(ruleReqDecoderSelect, rq); fill(ruleResDecoderSelect, rs);
}
addRuleBtn.addEventListener('click', () => {
  editingRuleIndex = -1;
  rulePatternInput.value = ''; ruleTypeSelect.value = 'string';
  fillDecoderSelects();
  ruleReqDecoderSelect.value = 'raw'; ruleResDecoderSelect.value = 'raw';
  ruleKeysInput.value = '';
  ruleFormError.style.display = 'none'; ruleForm.style.display = 'block';
  addRuleBtn.style.display = 'none'; rulePatternInput.focus();
});
cancelRuleBtn.addEventListener('click', hideRuleForm);
saveRuleBtn.addEventListener('click', () => {
  const pattern = rulePatternInput.value.trim();
  const isRegex = ruleTypeSelect.value === 'regex';
  const reqDecoder = ruleReqDecoderSelect.value;
  const resDecoder = ruleResDecoderSelect.value;
  if (!pattern) return showRuleError('请填写域名模式');
  if (isRegex) { try { new RegExp(pattern); } catch (e) { return showRuleError('正则无效：' + e.message); } }
  if (!reqDecoder && !resDecoder) return showRuleError('至少选择一个算法');
  let keys = null;
  const keysStr = ruleKeysInput.value.trim();
  if (keysStr) { try { keys = JSON.parse(keysStr); } catch (e) { return showRuleError('密钥 JSON 无效：' + e.message); } }
  const rule = { pattern, isRegex, reqDecoder, resDecoder };
  if (keys) rule.keys = keys;
  if (editingRuleIndex >= 0) sessionRules[editingRuleIndex] = rule; else sessionRules.push(rule);
  renderRuleList(); hideRuleForm();
  if (state.har.log.entries.length) rebuildEntryList();
  showToast('会话规则已添加', 'ok');
});

function refreshAll() {
  if (state.har.log.entries.length) { rebuildEntryList(); renderDetail(); }
  if (configModal.style.display === 'flex') fillDecoderSelects();
}

function genExportDecoders() {
  if (!Object.keys(sessionDecoders).length) { exportOutput.value = '// 会话内暂无算法'; return; }
  const lines = ['window.HAR_DECODERS = {'];
  for (const [id, d] of Object.entries(sessionDecoders)) {
    lines.push('');
    lines.push(`  ${id}: {`);
    lines.push(`    label: ${JSON.stringify(d.label)},`);
    lines.push(`    cdn: ${JSON.stringify(d.cdn || [])},`);
    lines.push(`    code: \`${(d.code || '').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\``);
    lines.push(`  },`);
  }
  lines.push('', '};');
  exportOutput.value = lines.join('\n');
}
function genExportRules() {
  if (!sessionRules.length) { exportOutput.value = '// 会话内暂无规则'; return; }
  const lines = ['['];
  sessionRules.forEach(r => {
    lines.push('  {');
    lines.push(`    pattern: ${JSON.stringify(r.pattern)},`);
    lines.push(`    isRegex: ${r.isRegex},`);
    lines.push(`    reqDecoder: ${JSON.stringify(r.reqDecoder)},`);
    const parts = [`    resDecoder: ${JSON.stringify(r.resDecoder)}`];
    if (r.keys) { const keysStr = JSON.stringify(r.keys, null, 2).split('\n').join('\n    '); parts.push(`    keys: ${keysStr}`); }
    lines.push(parts.join(',\n'));
    lines.push('  },');
  });
  lines.push(']');
  exportOutput.value = lines.join('\n');
}

$('exportDecodersBtn').addEventListener('click', genExportDecoders);
$('exportRulesBtn').addEventListener('click', genExportRules);
$('copyExportBtn').addEventListener('click', async () => {
  if (!exportOutput.value) return showToast('请先生成内容', 'err');
  try { await navigator.clipboard.writeText(exportOutput.value); showToast('已复制', 'ok'); }
  catch { showToast('复制失败', 'err'); }
});

// 8 秒空状态检测
setTimeout(() => {
  if (state.har.log.entries.length === 0) {
    console.warn('[HAR-Decrypt][Panel] ⚠️ 8 秒内未捕获任何请求');
    detailPanel.innerHTML = `
      <div class="empty" style="padding-top:60px;text-align:left;max-width:560px;margin:0 auto;">
        <div style="font-size:15px;color:#ffcc80;margin-bottom:16px;font-weight:bold;">⚠️ 暂未捕获到网络请求</div>
        <div style="line-height:1.9;color:rgba(255,255,255,.75);font-size:13px;">
          <p style="margin:8px 0;"><b style="color:#9ad0ff;">Firefox 用户必须做的事：</b></p>
          <p style="margin:6px 0;padding-left:16px;">1. 点击 DevTools 顶部「<b>网络</b>」标签</p>
          <p style="margin:6px 0;padding-left:16px;">2. 回到本「HAR 解密」面板</p>
          <p style="margin:6px 0;padding-left:16px;">3. <b>刷新目标网页</b></p>
          <hr style="margin:16px 0;border:none;border-top:1px dashed rgba(255,255,255,.15);">
          <p style="margin:6px 0;padding-left:16px;">· 本面板只能捕获「面板打开之后」发出的请求</p>
          <p style="margin:6px 0;padding-left:16px;">· 按 F12 打开控制台查看详细日志（前缀 <b>[HAR-Decrypt]</b>）</p>
        </div>
      </div>
    `;
  } else {
    console.log('[HAR-Decrypt][Panel] ✅ 已捕获', state.har.log.entries.length, '条请求');
  }
}, 8000);