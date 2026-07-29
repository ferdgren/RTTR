(function () {
  function markActiveNav(headerEl) {
    var page = location.pathname.split('/').pop() || 'index.html';
    var current = page + (location.hash || '');
    headerEl.querySelectorAll('.nav-link').forEach(function (link) {
      if (link.getAttribute('href') === current) {
        var item = link.closest('.nav-item');
        if (item) item.classList.add('active');
      }
    });
  }

  document.querySelectorAll('[data-include]').forEach(function (el) {
    var url = el.getAttribute('data-include');
    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load ' + url + ': ' + res.status);
        return res.text();
      })
      .then(function (html) {
        el.innerHTML = html;
        if (el.id === 'site-header') {
          markActiveNav(el);
        }
      })
      .catch(function (err) {
        if (window.console && console.error) console.error('Partial include failed:', err);
      });
  });
})();
