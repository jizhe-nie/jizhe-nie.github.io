// 建站时间线的筛选和排序。筛选条件：来源（博客 / 简历站）、类型标签；两者同时选时取交集。
(function () {
  var root = document.getElementById('timeline');
  if (!root) return;

  var list = root.querySelector('.tl-list');
  var chips = Array.prototype.slice.call(root.querySelectorAll('.tl-chip'));
  var state = { repo: null, tag: null };

  function apply() {
    Array.prototype.forEach.call(list.children, function (li) {
      var tags = (li.getAttribute('data-tags') || '').split(' ');
      var ok = (!state.repo || li.getAttribute('data-repo') === state.repo) &&
               (!state.tag || tags.indexOf(state.tag) >= 0);
      if (ok) li.removeAttribute('hidden'); else li.setAttribute('hidden', '');
    });
    chips.forEach(function (c) {
      var kind = c.getAttribute('data-kind');
      var on = kind === 'all' ? !state.repo && !state.tag : state[kind] === c.getAttribute('data-value');
      c.classList.toggle('is-active', on);
    });
  }

  root.addEventListener('click', function (e) {
    var chip = e.target.closest('.tl-chip');
    if (chip) {
      var kind = chip.getAttribute('data-kind');
      if (kind === 'all') { state.repo = null; state.tag = null; }
      else {
        var v = chip.getAttribute('data-value');
        state[kind] = state[kind] === v ? null : v; // 再点一次取消
      }
      apply();
      return;
    }
    if (e.target.closest('#tl-order')) {
      var items = Array.prototype.slice.call(list.children).reverse();
      items.forEach(function (li) { list.appendChild(li); });
      root.setAttribute('data-order', root.getAttribute('data-order') === 'asc' ? 'desc' : 'asc');
    }
  });

  apply();
})();
