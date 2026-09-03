(function () {
  var root = document.getElementById('root');
  if (!root) return;
  document.documentElement.dataset.laojieMounted = 'true';
  root.innerHTML =
    '<main class="legacy-fallback" aria-labelledby="legacy-title"><p class="eyebrow">屯溪老街 · 品牌经营体验</p><h1 id="legacy-title">老街品牌局</h1><p>当前浏览器正在使用兼容界面。请返回普通学生端，获得完整的经营体验。</p><form><label>班级码<input required autocomplete="off" placeholder="例如 LAOJIE11"></label><label>学号<input required autocomplete="off"></label><label>姓名<input required autocomplete="name"></label><button type="submit">进入品牌局</button></form><p class="legacy-note">姓名和学号只用于教师查看学习过程，不会出现在匿名课堂案例、公开页面或网址中。</p></main>';
  root.querySelector('form').addEventListener('submit', function (event) {
    event.preventDefault();
    root.querySelector('.legacy-note').textContent =
      '兼容界面已准备好。请刷新后从普通学生端进入品牌局。';
  });
})();
