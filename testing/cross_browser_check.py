#!/usr/bin/env python3
"""
Cross-browser + responsive smoke test for the RTTR site.

For every page x every browser engine (chromium, firefox, webkit) x every
viewport width in the standard breakpoint matrix: loads the page, checks
for zero horizontal overflow, confirms the shared nav actually rendered,
and collects any JS console/page errors.

Usage:
    python3 -m http.server 8000 --directory /path/to/RTTR &
    python3 testing/cross_browser_check.py --base http://localhost:8000
"""
import argparse
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

REPO_ROOT = Path(__file__).resolve().parent.parent
SKIP_SUFFIXES = (".bak", ".before-race", ".after-race")
VIEWPORTS = [320, 375, 768, 1024, 1440]
ENGINES = ["chromium", "firefox", "webkit"]
SYSTEM_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def discover_pages():
    pages = []
    for f in REPO_ROOT.rglob("*.html"):
        rel = f.relative_to(REPO_ROOT)
        if rel.parts[0].startswith(".") or rel.parts[0] == "partials":
            continue
        if any(f.name.endswith(suf) for suf in SKIP_SUFFIXES):
            continue
        pages.append(str(rel))
    return sorted(pages)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:8000")
    parser.add_argument("--engines", nargs="+", default=ENGINES, choices=ENGINES)
    parser.add_argument("--widths", nargs="+", type=int, default=VIEWPORTS)
    parser.add_argument("--pages", nargs="+", default=None, help="Limit to specific page filenames")
    args = parser.parse_args()

    pages = args.pages or discover_pages()
    failures = []
    total = 0

    with sync_playwright() as p:
        for engine_name in args.engines:
            engine = getattr(p, engine_name)
            launch_kwargs = {"headless": True}
            if engine_name == "chromium":
                launch_kwargs["executable_path"] = SYSTEM_CHROME
            browser = engine.launch(**launch_kwargs)
            for page_name in pages:
                for width in args.widths:
                    total += 1
                    ctx = browser.new_context(viewport={"width": width, "height": 900})
                    page = ctx.new_page()
                    console_errors = []
                    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
                    page.on("pageerror", lambda exc: console_errors.append(str(exc)))

                    try:
                        page.goto(f"{args.base}/{page_name}", timeout=15000)
                        page.wait_for_timeout(700)

                        overflow = page.evaluate("document.body.scrollWidth - window.innerWidth")
                        header_html = page.eval_on_selector("#site-header", "el => el ? el.innerHTML.length : -1") \
                            if page.query_selector("#site-header") else -1

                        problems = []
                        if overflow and overflow > 2:
                            problems.append(f"horizontal overflow {overflow}px")
                        if header_html == 0:
                            problems.append("shared header did not render (empty #site-header)")
                        if header_html == -1 and page_name != "about.html":
                            problems.append("no #site-header element found")
                        if console_errors:
                            problems.append(f"console errors: {console_errors[:3]}")

                        if problems:
                            failures.append((engine_name, page_name, width, "; ".join(problems)))
                    except Exception as e:
                        failures.append((engine_name, page_name, width, f"failed to load: {e}"))
                    finally:
                        ctx.close()
            browser.close()

    print(f"Ran {total} checks ({len(args.engines)} engines x {len(pages)} pages x {len(args.widths)} widths).\n")
    if failures:
        print(f"--- {len(failures)} FAILURE(S) ---")
        for engine_name, page_name, width, detail in failures:
            print(f"  [{engine_name} @ {width}px] {page_name}: {detail}")
        sys.exit(1)
    else:
        print("All pages clean across all engines and viewport widths.")
        sys.exit(0)


if __name__ == "__main__":
    main()
