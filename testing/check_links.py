#!/usr/bin/env python3
"""
Link checker for the RTTR site.

Crawls every top-level HTML page (and partials/) served by a local server,
checks every internal href/src resolves (200) and that anchor fragments
(#foo) exist on the target page, and checks external links are reachable.

Usage:
    python3 -m http.server 8000 --directory /path/to/RTTR &
    python3 testing/check_links.py --base http://localhost:8000
"""
import argparse
import html
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlsplit

import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
SKIP_SUFFIXES = (".bak", ".before-race", ".after-race")
HTML_COMMENT_RE = re.compile(r'<!--.*?-->', re.S)
LINK_ATTR_RE = re.compile(r'\b(?:href|src)="([^"]+)"')
ANCHOR_ID_RE = re.compile(r'(?:<a[^>]+name="([^"]+)")|(?:\bid="([^"]+)")')

EXTERNAL_TIMEOUT = 10
EXTERNAL_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; RTTR-link-checker/1.0)"}


def discover_pages():
    pages = []
    for f in REPO_ROOT.glob("*.html"):
        if any(f.name.endswith(suf) for suf in SKIP_SUFFIXES):
            continue
        pages.append(f.name)
    for f in (REPO_ROOT / "partials").glob("*.html"):
        pages.append(f"partials/{f.name}")
    return sorted(pages)


def extract_links(html_text):
    raw = LINK_ATTR_RE.findall(HTML_COMMENT_RE.sub("", html_text))
    return [html.unescape(link) for link in raw]


def classify(link):
    if link.startswith(("mailto:", "tel:", "javascript:")):
        return "skip"
    scheme = urlsplit(link).scheme
    if scheme in ("http", "https"):
        return "external"
    if link.startswith("#"):
        return "same-page-anchor"
    return "internal"


def check_internal(base, source_page, link, session, anchor_cache, results):
    path, _, fragment = link.partition("#")
    if not path:
        path = source_page
    url = urljoin(base + "/", path)
    try:
        resp = session.get(url, timeout=EXTERNAL_TIMEOUT)
        ok = resp.status_code == 200
    except requests.RequestException as e:
        results.append(("BROKEN", source_page, link, str(e)))
        return

    if not ok:
        results.append(("BROKEN", source_page, link, f"HTTP {resp.status_code}"))
        return

    if fragment:
        if path not in anchor_cache:
            anchor_cache[path] = set()
            for m in ANCHOR_ID_RE.finditer(HTML_COMMENT_RE.sub("", resp.text)):
                anchor_cache[path].add(m.group(1) or m.group(2))
        if fragment not in anchor_cache[path]:
            results.append(("BROKEN_ANCHOR", source_page, link, f"no id/name=\"{fragment}\" on {path}"))
            return

    results.append(("OK", source_page, link, f"HTTP {resp.status_code}"))


def check_external(source_page, link, session, external_cache, results):
    if link in external_cache:
        status = external_cache[link]
    else:
        try:
            resp = session.head(link, timeout=EXTERNAL_TIMEOUT, allow_redirects=True, headers=EXTERNAL_HEADERS)
            if resp.status_code >= 400:
                resp = session.get(link, timeout=EXTERNAL_TIMEOUT, allow_redirects=True, headers=EXTERNAL_HEADERS)
            status = resp.status_code
        except requests.RequestException as e:
            status = str(e)
        external_cache[link] = status

    if isinstance(status, int) and status < 400:
        results.append(("OK", source_page, link, f"HTTP {status}"))
    else:
        results.append(("EXTERNAL_WARN", source_page, link, str(status)))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:8000", help="Base URL of the running local server")
    parser.add_argument("--skip-external", action="store_true", help="Skip checking external links (faster)")
    args = parser.parse_args()

    pages = discover_pages()
    session = requests.Session()
    anchor_cache = {}
    external_cache = {}
    results = []

    for page in pages:
        url = urljoin(args.base + "/", page)
        try:
            resp = session.get(url, timeout=EXTERNAL_TIMEOUT)
        except requests.RequestException as e:
            results.append(("BROKEN", page, "(page itself)", str(e)))
            continue
        if resp.status_code != 200:
            results.append(("BROKEN", page, "(page itself)", f"HTTP {resp.status_code}"))
            continue

        for link in extract_links(resp.text):
            kind = classify(link)
            if kind == "skip" or kind == "same-page-anchor":
                continue
            elif kind == "internal":
                check_internal(args.base, page, link, session, anchor_cache, results)
            elif kind == "external" and not args.skip_external:
                check_external(page, link, session, external_cache, results)

    broken = [r for r in results if r[0] in ("BROKEN", "BROKEN_ANCHOR")]
    warned = [r for r in results if r[0] == "EXTERNAL_WARN"]
    ok_count = sum(1 for r in results if r[0] == "OK")

    print(f"Checked {len(pages)} pages, {len(results)} links total. {ok_count} OK.\n")

    if warned:
        print(f"--- {len(warned)} external link(s) failed/unreachable (may be transient/bot-blocking, review manually) ---")
        for status, page, link, detail in warned:
            print(f"  [{status}] {page} -> {link}  ({detail})")
        print()

    if broken:
        print(f"--- {len(broken)} BROKEN internal link(s) ---")
        for status, page, link, detail in broken:
            print(f"  [{status}] {page} -> {link}  ({detail})")
        sys.exit(1)
    else:
        print("No broken internal links or anchors.")
        sys.exit(0)


if __name__ == "__main__":
    main()
