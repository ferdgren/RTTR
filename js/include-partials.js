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
  function applyContent(el, html) {
    el.innerHTML = html;
    if (el.id === 'site-header') markActiveNav(el);
  }

  document.querySelectorAll('[data-include]').forEach(function (el) {
    var url = el.getAttribute('data-include');
    el.removeAttribute('data-include');
    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load ' + url + ': ' + res.status);
        return res.text();
      })
      .then(function (html) {
        applyContent(el, html);
      })
      .catch(function (err) {
        if (window.console && console.error) console.error('Partial include failed:', err);
        // <noscript> content is inert while scripting is enabled, so if the
        // fetch fails, the fallback markup already sitting in the DOM won't
        // render on its own -- pull its raw text out and activate it manually
        // so a failed fetch degrades to the same fallback a JS-disabled
        // visitor gets, instead of a blank header/footer.
        var fallback = el.querySelector('noscript');
        if (fallback) applyContent(el, fallback.textContent);
      });
  });
})();
