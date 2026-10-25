/**
 * ============================================================
 *  域名 → 解密算法映射
 * ============================================================
 *
 *  匹配规则：
 *    isRegex = false : url.includes(pattern)
 *    isRegex = true  : new RegExp(pattern).test(url)
 *
 *  从上往下遍历，第一条命中的规则生效。
 *
 *  字段说明：
 *    pattern     : 域名片段或正则表达式
 *    isRegex     : 是否按正则匹配
 *    reqDecoder  : 请求体默认使用的算法 id（没有请求体也无所谓）
 *    resDecoder  : 响应体默认使用的算法 id
 *
 *  算法 id 必须存在于 decoders.js 的 window.HAR_DECODERS 中
 *  或存在于内置算法中：raw / utf8 / json / gunzip / inflate / gzipFix / base64ThenJson
 * ============================================================
 */

window.HAR_RULES = [

  
  {
    pattern: "xxgame.cn",
    isRegex: false,
    reqDecoder: "gzipFix",
    resDecoder: "gzipFix"
  },

  // 示例：用正则匹配所有 a.example.com 与 b.example.com 的子域
  // {
  //   pattern: '^https?://([ab])\\.example\\.com/',
  //   isRegex: true,
  //   reqDecoder: 'raw',
  //   resDecoder: 'myAesCbc',
  // },

];