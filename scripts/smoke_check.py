#!/usr/bin/env python3
"""Post-deploy smoke test for a running SONAR site.

    python3 scripts/smoke_check.py https://sonar-two-brown.vercel.app
    python3 scripts/smoke_check.py http://127.0.0.1:4173          # a local build

Checks that every section serves, errors are real 404s rather than 200s or
5xx, security headers are present, static assets are cacheable, and nothing
is slow. Standard library only; exits 1 if any check fails, so it can gate a
deploy or run on a schedule.

A Vercel deployment behind Vercel Authentication answers 401 to anyone
without a session. Set VERCEL_PROTECTION_BYPASS to the project's
"Protection Bypass for Automation" secret and it is sent as
`x-vercel-protection-bypass`.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass

from _common import safe_urlopen

SECTIONS = ("/", "/stats", "/radar", "/war-room", "/updates")
REQUIRED_HEADERS = {
    "x-content-type-options": re.compile(r"nosniff", re.I),
    "referrer-policy": re.compile(r"."),
    "content-security-policy": re.compile(r"frame-ancestors", re.I),
    "strict-transport-security": re.compile(r"max-age=\d+", re.I),
}
SLOW_SECONDS = 3.0


@dataclass
class Response:
    status: int
    headers: dict[str, str]
    body: str
    seconds: float


@dataclass
class Check:
    name: str
    ok: bool
    detail: str = ""


def fetch(url: str, bypass: str | None = None, timeout: float = 20.0) -> Response:
    """GET a URL and return the response whatever its status (4xx/5xx included)."""
    request = urllib.request.Request(url, headers={"User-Agent": "sonar-smoke/1.0"})  # noqa: S310 - opened via safe_urlopen
    if bypass:
        request.add_header("x-vercel-protection-bypass", bypass)
    started = time.monotonic()
    try:
        with safe_urlopen(request, timeout=timeout) as resp:
            status, headers, raw = resp.status, resp.headers, resp.read()
    except urllib.error.HTTPError as err:
        status, headers, raw = err.code, err.headers, err.read()
    elapsed = time.monotonic() - started
    return Response(
        status=status,
        headers={k.lower(): v for k, v in headers.items()},
        body=raw.decode("utf-8", errors="replace"),
        seconds=elapsed,
    )


def run_checks(base: str, bypass: str | None = None) -> list[Check]:
    base = base.rstrip("/")
    checks: list[Check] = []

    def add(name: str, ok: bool, detail: str = "") -> None:
        checks.append(Check(name, ok, detail))

    home = fetch(base + "/", bypass)
    if home.status in (401, 403):
        add("site is reachable", False, f"HTTP {home.status}: behind authentication. Set VERCEL_PROTECTION_BYPASS.")
        return checks

    for path in SECTIONS:
        resp = home if path == "/" else fetch(base + path, bypass)
        add(f"GET {path} -> 200", resp.status == 200, f"HTTP {resp.status}")
        add(f"GET {path} renders the app", "SONAR" in resp.body, "page does not mention SONAR")
        add(f"GET {path} is not slow", resp.seconds < SLOW_SECONDS, f"{resp.seconds:.2f}s")
        add(
            f"GET {path} has no server-error text",
            not re.search(r"internal server error|unhandled", resp.body, re.I),
            "error text found in page",
        )

    missing = fetch(base + "/definitely-not-a-page-9f3a", bypass)
    add("unknown path is a real 404", missing.status == 404, f"HTTP {missing.status}")

    for name, pattern in REQUIRED_HEADERS.items():
        value = home.headers.get(name, "")
        add(f"header {name}", bool(pattern.search(value)), f"got {value!r}" if value else "missing")

    for path in ("/robots.txt", "/favicon.ico"):
        add(f"GET {path} -> 200", fetch(base + path, bypass).status == 200)

    asset = re.search(r'(?:src|href)="(/assets/[^"]+\.js)"', home.body)
    if asset:
        resp = fetch(base + asset.group(1), bypass)
        add("script bundle loads", resp.status == 200, f"HTTP {resp.status}")
        add(
            "script bundle is cached long-term",
            "immutable" in resp.headers.get("cache-control", ""),
            resp.headers.get("cache-control", "no cache-control"),
        )
    else:
        add("script bundle is referenced by the page", False, "no /assets/*.js reference found")

    return checks


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("url", help="base URL of the deployment")
    args = parser.parse_args(argv)

    checks = run_checks(args.url, os.environ.get("VERCEL_PROTECTION_BYPASS") or None)
    width = max(len(c.name) for c in checks)
    for c in checks:
        mark = "ok  " if c.ok else "FAIL"
        extra = "" if c.ok or not c.detail else f"  ({c.detail})"
        print(f"{mark} {c.name:<{width}}{extra}")
    failed = [c for c in checks if not c.ok]
    print(f"\n{len(checks) - len(failed)}/{len(checks)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
