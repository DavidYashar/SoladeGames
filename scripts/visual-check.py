"""Capture the hall, the four cabinets and the account pages for visual review.

    python scripts/visual-check.py
    python scripts/visual-check.py --base http://localhost:3050 --out checks
    python scripts/visual-check.py --only pinball,hall

The cabinets sit behind the player gate, so run against `npm run dev`: the dev
stand-in (`/api/dev/player`) only answers there, and every capture carries an amber
"DEV PLAYER" ribbon so nobody mistakes a screenshot for a signed-in session.

Requires Playwright for Python:
    python -m pip install playwright
    python -m playwright install chromium
"""

from __future__ import annotations

import argparse
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

# name -> (path, wait after load in ms, press start?)
ROUTES: dict[str, tuple[str, int, bool]] = {
    "hall": ("/", 1_200, False),
    "stack-tower": ("/games/stack-tower", 2_500, True),
    "brick-blitz": ("/games/brick-blitz", 2_500, True),
    "bubble-pop": ("/games/bubble-pop", 2_500, True),
    "pinball": ("/games/pinball", 3_000, True),
    "puzzle": ("/play", 1_500, False),
    "profile": ("/profile", 1_500, False),
}

START_LABEL = re.compile("insert coin", re.IGNORECASE)


def server_is_up(base: str) -> bool:
    try:
        with urllib.request.urlopen(base, timeout=5) as response:
            return response.status < 500
    except (urllib.error.URLError, TimeoutError):
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://localhost:3000", help="running dev server")
    parser.add_argument("--out", default="checks", help="output directory")
    parser.add_argument("--width", type=int, default=1440)
    parser.add_argument("--height", type=int, default=1000)
    parser.add_argument("--only", default="", help="comma-separated route names")
    args = parser.parse_args()

    base = args.base.rstrip("/")
    if not server_is_up(base):
        print(f"nothing answering at {base} - start it with `npm run dev` first", file=sys.stderr)
        return 1

    selected = [n.strip() for n in args.only.split(",") if n.strip()]
    routes = {k: v for k, v in ROUTES.items() if not selected or k in selected}
    unknown = sorted(set(selected) - set(ROUTES))
    if unknown:
        print(f"unknown route(s): {', '.join(unknown)}", file=sys.stderr)
        return 1

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    failures: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            for name, (path, wait_ms, press_start) in routes.items():
                page = browser.new_page(
                    viewport={"width": args.width, "height": args.height},
                    device_scale_factor=1,
                )
                errors: list[str] = []
                page.on("pageerror", lambda e: errors.append(str(e)))
                try:
                    page.goto(f"{base}{path}", wait_until="networkidle", timeout=30_000)
                    if press_start:
                        # Cabinets open on a shared "INSERT COIN" overlay; start the
                        # machine so the capture is gameplay, not the title card.
                        start = page.get_by_role("button", name=START_LABEL)
                        if start.count() > 0:
                            start.first.click(timeout=10_000)
                        else:
                            failures.append(f"{name}: no start button found")
                    page.wait_for_timeout(wait_ms)
                    target = out / f"{name}.png"
                    page.screenshot(path=str(target))
                    note = f"  ({len(errors)} page error(s))" if errors else ""
                    print(f"{name:<12} {target}{note}")
                    if errors:
                        failures.append(f"{name}: {errors[0]}")
                except Exception as exc:  # noqa: BLE001 - report and keep going
                    failures.append(f"{name}: {exc}")
                    print(f"{name:<12} FAILED  {exc}", file=sys.stderr)
                finally:
                    page.close()
        finally:
            browser.close()

    if failures:
        print(f"\n{len(failures)} route(s) had problems:", file=sys.stderr)
        for failure in failures:
            print(f"  {failure}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
