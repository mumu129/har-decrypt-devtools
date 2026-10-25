// ============================================================
// HAR-Decrypt DevTools 入口
// ============================================================
console.log('[HAR-Decrypt][devtools.js] loaded');

(function () {
  const hasChrome = typeof chrome !== 'undefined';
  const hasBrowser = typeof browser !== 'undefined';

  console.log('[HAR-Decrypt][devtools.js] typeof chrome =', hasChrome ? 'object' : 'undefined');
  console.log('[HAR-Decrypt][devtools.js] typeof browser =', hasBrowser ? 'object' : 'undefined');

  const devtoolsApi = hasBrowser && browser.devtools ? browser.devtools
                    : hasChrome && chrome.devtools ? chrome.devtools
                    : null;

  console.log('[HAR-Decrypt][devtools.js] devtoolsApi =', devtoolsApi ? 'OK' : 'MISSING');

  if (!devtoolsApi || !devtoolsApi.panels) {
    console.error('[HAR-Decrypt][devtools.js] ❌ devtools.panels API 不可用，扩展无法注册面板');
    return;
  }

  try {
    devtoolsApi.panels.create(
      'HAR 解密',
      '',
      'panel.html',
      (panel) => {
        console.log('[HAR-Decrypt][devtools.js] ✅ panel 创建成功');
        if (panel && panel.onShown) {
          panel.onShown.addListener((win) => {
            console.log('[HAR-Decrypt][devtools.js] panel onShown');
          });
        }
      }
    );
  } catch (e) {
    console.error('[HAR-Decrypt][devtools.js] ❌ panel 创建失败:', e);
  }
})();