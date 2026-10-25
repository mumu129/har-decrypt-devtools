下面是 `README.md` 文件内容，以及 Chrome 和 Firefox 的打包发布指南。

---

## 📄 `README.md`

将以下内容保存为项目根目录的 `README.md` 文件。

```markdown
# HAR 解密查看器 - DevTools 扩展

一个浏览器 DevTools 扩展，用于**实时抓取网络请求，点击请求即可自动解密/解码请求体与响应体**。支持自定义解密算法、域名规则、密钥配置、全文搜索、请求标记与备注、导出 HAR 等功能。

## ✨ 功能特性

- **实时抓取**：基于 `chrome.devtools.network` / `browser.devtools.network`，在 DevTools 打开期间实时监听所有 HTTP 请求
- **点击解密**：点击请求时自动拉取响应体，并按域名规则匹配解密算法
- **自定义算法**：通过 `decoders.js` 定义任意 JS 解密函数（支持同步/异步），内置智能解析、gzip 修复、Base64、JSON 等常用算法
- **域名规则**：通过 `rules.js` 将域名与解密算法绑定，不同域名可配置不同密钥
- **全文搜索**：搜索请求任意位置（URL、头、请求体、响应体），不区分大小写
- **多维过滤**：按方法、类型、MIME、域名进行三态过滤（包含/排除/未选）
- **标记与备注**：右键请求可标记颜色、添加备注
- **导出**：支持导出解密后的 HAR、导出筛选后的 HAR
- **时间戳识别**：JSON 中 10 位/13 位、1 开头的时间戳自动显示为可读日期
- **媒体预览**：图片、音频、视频直接内嵌预览

## 📁 文件结构

```
har-decrypt-devtools/
├── manifest.json      # 扩展清单（MV3）
├── devtools.html      # DevTools 页面入口
├── devtools.js        # 注册自定义 DevTools 面板
├── panel.html         # 面板 UI 结构
├── panel.js           # 面板核心逻辑
├── pako.min.js        # gzip/zlib 解压库（本地化，MV3 禁止远程 CDN）
├── decoders.js        # 自定义解密算法定义（含模板）
├── rules.js           # 域名 → 算法映射
└── README.md          # 本文件
```

## 🚀 快速开始

### Chrome / Edge

1. 打开 `chrome://extensions/`
2. 右上角开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**，选择本项目文件夹
4. **完全关闭 DevTools 再重新打开**
5. DevTools 顶部会出现 **“HAR 解密”** 标签，点击进入
6. **刷新目标网页**，请求将实时出现在列表中

### Firefox

1. 地址栏输入 `about:debugging`
2. 左侧选择 **This Firefox**
3. 点击 **临时加载附加组件**
4. 选择项目中的 `manifest.json`
5. **完全关闭 DevTools 再重新打开**
6. DevTools 顶部会出现 **“HAR 解密”** 标签
7. **先点击一下原生“网络”标签**（Firefox 限制，`onRequestFinished` 需要网络面板激活后才触发）
8. 切回“HAR 解密”面板，**刷新目标网页**

> Firefox 临时加载的扩展在浏览器重启后会消失，需要重新加载。如需持久化，参考下方“打包与发布”。

## 🔧 自定义解密算法

编辑 `decoders.js` 中的 `window.HAR_DECODERS` 对象：

```javascript
window.HAR_DECODERS = {
  myDecrypt: {
    label: '我的解密算法',
    cdn: [],  // MV3 扩展中 CDN 会被 CSP 拦截，请将依赖本地化
    code: `function(bytes, ctx) {
      // bytes: Uint8Array，响应原始字节
      // ctx.keys: 来自域名规则中配置的密钥对象
      const raw = pako.ungzip(bytes);
      return JSON.parse(new TextDecoder().decode(raw));
    }`
  }
};
```

**代码签名**：`function(bytes, ctx)` 或 `async function(bytes, ctx)`。`bytes` 为 `Uint8Array`，`ctx.keys` 为该请求命中的域名规则中配置的 `keys` 对象。返回值可以是 `string`、`object` 或 `Uint8Array`。

**可用全局变量**：`pako`、`TextDecoder`、`TextEncoder`、`atob`、`btoa`、`JSON`、`crypto`（Web Crypto API）。

### 内置模板

`decoders.js` 的 `window.HAR_TEMPLATES` 中预置了以下模板，新增算法时可直接填充：

- **gzip 头修复 + 解压**：适用于服务端篡改 gzip 头的情况
- **Base64 + JSON**：响应为 Base64 字符串，解码后为 JSON
- **AES-256-CBC**：需要 `ctx.keys.key` 和 `ctx.keys.iv`
- **AES-256-GCM**：需要 `ctx.keys.key`，IV 默认取前 12 字节
- **zlib inflate**：标准 zlib 流解压
- **单字节 XOR**：需要 `ctx.keys.key` 为 0-255 整数

## 🌐 域名规则与密钥

编辑 `rules.js` 中的 `window.HAR_RULES` 数组：

```javascript
window.HAR_RULES = [
  {
    pattern: 'api.example.com',
    isRegex: false,
    reqDecoder: 'raw',
    resDecoder: 'myDecrypt',
    keys: {
      key: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
      iv:  '000102030405060708090a0b0c0d0e0f'
    }
  }
];
```

| 字段 | 说明 |
|---|---|
| `pattern` | 匹配字符串或正则表达式 |
| `isRegex` | `true` 时按正则匹配 |
| `reqDecoder` | 请求体默认解码算法 ID |
| `resDecoder` | 响应体默认解码算法 ID |
| `keys` | 可选，任意 JSON 对象，算法中通过 `ctx.keys` 读取 |

同一算法可被多条规则引用，不同域名配置不同 `keys` 即可。

## ⚠️ 注意事项

### MV3 CSP 限制

Manifest V3 扩展**禁止加载远程 CDN 脚本**。`decoders.js` 中 `cdn` 字段在当前架构下不会生效。如需第三方库（如 `crypto-js`），请将库文件下载到扩展目录，在 `panel.html` 中通过 `<script src="./crypto-js.min.js">` 加载，算法代码中直接使用全局变量。

### 响应体获取限制

- 面板打开**之前**已存在的请求，`getContent()` 无法拉取响应体（列表中标记为“历史”）
- 响应体超过 **15MB** 时不自动拉取
- 跨域资源可能返回空内容
- `getContent()` 每个请求通常只能成功调用一次，结果会缓存

### Firefox 特殊限制

Firefox 的 `devtools.network.onRequestFinished` **必须先手动激活一次原生“网络”面板**才会开始触发。操作流程：先点一下“网络”标签，再切回“HAR 解密”面板，然后刷新目标网页。

### DevTools 必须重启

修改扩展代码或重新加载扩展后，**必须完全关闭 DevTools 窗口再重新打开**，否则浏览器仍使用旧代码。

## 📦 打包与发布

### 打包 Chrome 扩展

**方式一：直接上传 ZIP 到 Chrome Web Store（推荐）**

1. 将项目文件夹中的所有文件（`manifest.json` 必须在 ZIP 根目录）压缩为 `.zip`
2. 访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
3. 支付一次性 $5 开发者注册费
4. 点击“新增项目”，上传 ZIP 文件
5. 填写商店信息并提交审核

**方式二：本地生成 `.crx`（仅用于手动分发）**

在 `chrome://extensions/` 开发者模式下，点击 **“打包扩展程序”**，选择项目文件夹，生成 `.crx` 和 `.pem` 私钥文件。注意：`.crx` 手动安装会被 Chrome 拦截，仅适合企业策略或开发者自用。

### 打包 Firefox 扩展

Firefox 扩展需要**签名**才能 permanent 安装。推荐使用 `web-ext` 工具。

**1. 安装 web-ext**

```bash
npm install --global web-ext
```

**2. 获取 AMO API 密钥**

访问 [addons.mozilla.org/developers/addon/api/key/](https://addons.mozilla.org/developers/addon/api/key/) 生成 JWT Issuer 和 JWT Secret。

**3. 在 `manifest.json` 中添加 `browser_specific_settings.gecko.id`**

```json
{
  "browser_specific_settings": {
    "gecko": {
      "id": "your-extension@yourdomain.com",
      "strict_min_version": "109.0"
    }
  }
}
```

**4. 签名扩展**

```bash
web-ext sign \
  --channel=unlisted \
  --api-key=YOUR_JWT_ISSUER \
  --api-secret=YOUR_JWT_SECRET \
  --source-dir=./your-extension-dir \
  --artifacts-dir=./dist
```

签名后的 `.xpi` 文件会下载到 `dist/` 目录。`--channel=unlisted` 表示自托管分发，不上架 AMO 商店。

**5. 分发 `.xpi`**

将签名后的 `.xpi` 放到你自己的服务器或 GitHub Releases，用户下载后在 Firefox 中打开即可安装。

**方式二：仅开发测试，不签名**

直接通过 `about:debugging` 临时加载，浏览器重启后失效。

## 🛠 开发调试

- **Chrome**：在面板中右键 → 检查，或使用 `chrome://extensions/` 的“错误”按钮查看异常
- **Firefox**：在 `about:debugging` 中点击扩展的“检查”按钮，打开扩展专属控制台
- **日志前缀**：所有日志均以 `[HAR-Decrypt]` 开头，便于过滤

## 📄 License

MIT
```

---

## 📦 打包成 Chrome / Firefox 扩展

### Chrome 扩展打包

Chrome 扩展的发布格式本质上是 **ZIP 文件**（Web Store 上传用 `.zip`，浏览器实际安装为 `.crx`）。

**手动打包 ZIP（用于 Web Store 上传）**：

确保 `manifest.json` 位于 ZIP **根目录**，而不是嵌套在文件夹里。

```bash
# 在项目根目录执行
zip -r har-decrypt-devtools.zip . -x "*.git*" "*.md" "node_modules/*"
```

然后到 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard) 创建新项目、上传 ZIP、提交审核。

**本地生成 `.crx`（仅自用/企业分发）**：

`chrome://extensions/` → 开发者模式 → “打包扩展程序” → 选择项目文件夹 → 生成 `.crx` 和 `.pem`。注意：手动 `.crx` 安装会被 Chrome 拦截，不建议作为常规分发方式。

---

### Firefox 扩展打包

Firefox 扩展正式分发需要**签名**，生成 `.xpi` 文件（本质也是 ZIP）。

**步骤 1：确保 `manifest.json` 有 `gecko.id`**

Firefox MV3 强制要求：

```json
"browser_specific_settings": {
  "gecko": {
    "id": "har-decrypt@yourdomain.com",
    "strict_min_version": "109.0"
  }
}
```

**步骤 2：安装 `web-ext` 并签名**

```bash
npm install --global web-ext
```

**步骤 3：获取 AMO API 密钥**

访问 [addons.mozilla.org/developers/addon/api/key/](https://addons.mozilla.org/developers/addon/api/key/)，生成 JWT Issuer 和 JWT Secret。

**步骤 4：签名并生成 `.xpi`**

```bash
web-ext sign \
  --channel=unlisted \
  --api-key=YOUR_JWT_ISSUER \
  --api-secret=YOUR_JWT_SECRET \
  --source-dir=. \
  --artifacts-dir=./dist
```

`--channel=unlisted` 表示自托管分发（不公开上架 AMO 商店），签名后的 `.xpi` 会输出到 `dist/`。

**步骤 5：分发**

将 `.xpi` 放到 GitHub Releases 或你自己的服务器，用户下载后在 Firefox 中打开即可安装。

---

### 开发阶段免打包

| 浏览器 | 方式 |
|---|---|
| Chrome | `chrome://extensions/` → 加载已解压的扩展程序 |
| Firefox | `about:debugging` → 临时加载附加组件 → 选择 `manifest.json` |

开发阶段直接加载文件夹即可，修改代码后重新加载扩展并**关闭重开 DevTools** 就能看到变化，不需要每次打包。