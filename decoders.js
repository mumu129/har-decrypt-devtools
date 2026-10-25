/**
 * ============================================================
 *  模板 + 算法定义
 * ============================================================
 *  · HAR_TEMPLATES : 编辑算法时的「从模板填充」下拉项
 *  · HAR_DECODERS  : 实际使用的算法（初始为空，手动添加或从网页导出后粘贴）
 *
 *  密钥相关：算法代码里可以从第二参数 ctx 拿到规则里的密钥配置，
 *           形如 ctx.keys = { key: "...", iv: "..." }
 *           具体字段由 rules.js 里每条规则的 keys 决定
 * ============================================================
 */

window.HAR_TEMPLATES = {

  gzipFix: {
    label: '模板·gzip 头修复 + 解压',
    code: `function(bytes) {
  const t = new Uint8Array(bytes);
  if (t.length < 8) throw new Error('数据长度 < 8');
  t[0] = 0x1f; t[1] = 0x8b; t[2] = 0x08; t[3] = 0x00;
  t[4] = 0x00; t[5] = 0x00; t[6] = 0x00; t[7] = 0x00;
  const raw = pako.ungzip(t);
  return JSON.parse(new TextDecoder().decode(raw));
}`
  },

  base64Json: {
    label: '模板·Base64 + JSON',
    code: `function(bytes) {
  const s = new TextDecoder().decode(bytes).trim();
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(out));
}`
  },

  aesCbc: {
    label: '模板·AES-256-CBC（需在规则中配置 key + iv）',
    code: `async function(bytes, ctx) {
  const keys = ctx?.keys || {};
  if (!keys.key) throw new Error('缺少密钥：请在域名规则中配置 keys.key（64 位 hex）');
  if (!keys.iv)  throw new Error('缺少 IV：请在域名规则中配置 keys.iv（32 位 hex）');

  const hexToBytes = h => Uint8Array.from(
    String(h).replace(/\\s+/g, '').match(/../g) || [],
    x => parseInt(x, 16)
  );

  const key = await crypto.subtle.importKey(
    'raw', hexToBytes(keys.key), { name: 'AES-CBC' }, false, ['decrypt']
  );
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: hexToBytes(keys.iv) }, key, bytes
  );
  return JSON.parse(new TextDecoder().decode(plain));
}`
  },

  aesGcm: {
    label: '模板·AES-256-GCM（需配置 key；iv 默认取响应前 12 字节）',
    code: `async function(bytes, ctx) {
  const keys = ctx?.keys || {};
  if (!keys.key) throw new Error('缺少密钥：请在域名规则中配置 keys.key（64 位 hex）');

  const hexToBytes = h => Uint8Array.from(
    String(h).replace(/\\s+/g, '').match(/../g) || [],
    x => parseInt(x, 16)
  );

  const iv = keys.iv ? hexToBytes(keys.iv) : bytes.slice(0, 12);
  const tagOffset = typeof keys.tagOffset === 'number' ? keys.tagOffset : -16;

  const ct = tagOffset < 0
    ? bytes.slice(iv.length, tagOffset)
    : bytes.slice(iv.length, tagOffset);
  const tag = tagOffset < 0
    ? bytes.slice(tagOffset)
    : bytes.slice(tagOffset, tagOffset + 16);

  const key = await crypto.subtle.importKey(
    'raw', hexToBytes(keys.key), { name: 'AES-GCM' }, false, ['decrypt']
  );
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 }, key, ct
  );
  return JSON.parse(new TextDecoder().decode(plain));
}`
  },

  inflate: {
    label: '模板·zlib inflate',
    code: `function(bytes) {
  const raw = pako.inflate(bytes);
  return JSON.parse(new TextDecoder().decode(raw));
}`
  },

  xorByte: {
    label: '模板·单字节 XOR（需配置 key 为整数 0-255）',
    code: `function(bytes, ctx) {
  const keys = ctx?.keys || {};
  const k = Number(keys.key);
  if (!Number.isFinite(k)) throw new Error('缺少密钥：请在域名规则中配置 keys.key（0-255 整数）');
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ k;
  try {
    return JSON.parse(new TextDecoder().decode(out));
  } catch {
    return new TextDecoder().decode(out);
  }
}`
  },

};

/**
 * 实际使用的算法
 * 初始为空。通过网页「解密配置 → + 会话内添加算法」试好后，
 * 用「导出配置 → 生成 decoders.js 片段」粘贴回这里即可永久生效。
 */
window.HAR_DECODERS = {
  // 示例：
  // myAes: {
  //   label: '我的 AES-CBC',
  //   cdn: [],
  //   code: `async function(bytes, ctx) {
  //     const { key, iv } = ctx?.keys || {};
  //     ...
  //   }`
  // },
};