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

  // This script tag may appear more than once per page (e.g. once right after
  // the header so it injects quickly, once after the footer so it doesn't have
  // to wait for the rest of the page to parse first). Each run only picks up
  // [data-include] elements still on the page -- processed ones have the
  // attribute removed below -- so re-running is safe and never double-fetches.
  document.querySelectorAll('[data-include]').forEach(function (el) {
    var url = el.getAttribute('data-include');
    el.removeAttribute('data-include');
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
