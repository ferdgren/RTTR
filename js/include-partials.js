(function () {
  function markActiveNav(headerEl) {
    // Only a genuinely empty path (root "/") means the homepage -- a
    // trailing slash on a nested page (e.g. /sponsors/piece/) must not
    // fall back to 'index.html' and false-highlight Home.
    var segments = location.pathname.split('/').filter(Boolean);
    var page = segments.length ? segments[segments.length - 1] : 'index.html';
    var current = page + (location.hash || '');
    headerEl.querySelectorAll('.nav-link').forEach(function (link) {
      if (link.getAttribute('href') === current) {
        var item = link.closest('.nav-item');
        if (item) item.classList.add('active');
      }
    });
  }

  // partials/header.html and partials/footer.html author their internal
  // links (images/2026Logo.png, sponsors.html, ...) as if the including page
  // lived at the site root -- true for every page so far, but not for a page
  // nested in a subdirectory (e.g. sponsors/piece/). Rather than hardcode
  // root-relative "/" paths (which would break the GitHub Pages beta preview,
  // a subpath deployment), derive the correct "back to root" prefix from the
  // include URL itself: "../../partials/header.html" implies a "../../"
  // prefix, "partials/header.html" implies no prefix at all.
  function rootPrefixFromIncludeUrl(url) {
    var idx = url.indexOf('partials/');
    return idx === -1 ? '' : url.slice(0, idx);
  }

  // Rewritten on the raw HTML string, before it's ever assigned to
  // innerHTML -- rewriting attributes afterward via the DOM is too late:
  // setting innerHTML makes the browser start fetching <img src> right away,
  // as part of that same parse, so a later src correction just means the
  // browser fetches the (still-briefly-requested) wrong URL and then the
  // right one, logging a spurious 404 for the first one along the way.
  function rewriteRelativeLinksInHtml(html, prefix) {
    if (!prefix) return html;
    var ABSOLUTE_RE = /^([a-z][a-z0-9+.-]*:|#|\/)/i;
    return html.replace(/((?:href|src)=")([^"]*)(")/gi, function (match, pre, val, post) {
      if (!val || ABSOLUTE_RE.test(val)) return match;
      return pre + prefix + val + post;
    });
  }

  // This script tag may appear more than once per page (e.g. once right after
  // the header so it injects quickly, once after the footer so it doesn't have
  // to wait for the rest of the page to parse first). Each run only picks up
  // [data-include] elements still on the page -- processed ones have the
  // attribute removed below -- so re-running is safe and never double-fetches.
  function applyContent(el, html, prefix) {
    el.innerHTML = prefix ? rewriteRelativeLinksInHtml(html, prefix) : html;
    if (el.id === 'site-header') markActiveNav(el);
  }

  document.querySelectorAll('[data-include]').forEach(function (el) {
    var url = el.getAttribute('data-include');
    el.removeAttribute('data-include');
    var prefix = rootPrefixFromIncludeUrl(url);
    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load ' + url + ': ' + res.status);
        return res.text();
      })
      .then(function (html) {
        applyContent(el, html, prefix);
      })
      .catch(function (err) {
        if (window.console && console.error) console.error('Partial include failed:', err);
        // <noscript> content is inert while scripting is enabled, so if the
        // fetch fails, the fallback markup already sitting in the DOM won't
        // render on its own -- pull its raw text out and activate it manually
        // so a failed fetch degrades to the same fallback a JS-disabled
        // visitor gets, instead of a blank header/footer. That fallback is
        // hand-authored per page with already-correct paths, so it must NOT
        // be rewritten again.
        var fallback = el.querySelector('noscript');
        if (fallback) applyContent(el, fallback.textContent);
      });
  });
})();
