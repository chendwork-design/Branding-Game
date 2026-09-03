(() => {
  const root = document.getElementById('root');
  if (!root) return;

  const showFailure = (detail, force) => {
    if (!force && document.documentElement.dataset.laojieMounted === 'true') return;
    root.innerHTML = `
      <main class="startup-fallback startup-failure" role="alert">
        <p class="eyebrow">屯溪老街 · 品牌经营体验</p>
        <h1>游戏界面暂未启动</h1>
        <p>请刷新页面后再试。若问题持续，请将下方提示截图发给教师。</p>
        <p class="startup-detail">提示：${detail}</p>
      </main>`;
  };

  window.addEventListener(
    'error',
    (event) => {
      const source = event.target;
      const detail =
        source instanceof HTMLScriptElement
          ? `脚本加载失败：${source.src || '未知脚本'}`
          : event.message || '页面脚本运行异常';
      showFailure(detail, true);
    },
    true,
  );
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    showFailure(reason || '页面脚本运行异常', true);
  });
  window.addEventListener('load', () => {
    window.setTimeout(() => showFailure('游戏脚本未能完成初始化'), 5000);
  });
})();
