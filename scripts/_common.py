"""Helpers shared by the SONAR scripts.

Kept deliberately small and standard-library only: the scripts run in CI and
on a laptop with nothing installed, which is a feature worth protecting.
"""

from __future__ import annotations

import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone

# South Africa has no daylight saving, so a fixed UTC+2 offset is exact and
# needs no tz database (which minimal CI images and Windows do not ship).
SAST = timezone(timedelta(hours=2), "SAST")

_LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}


def today_sast(now: datetime | None = None) -> date:
    """Today's date on a Johannesburg wall clock.

    `date.today()` reads the host's local zone. GitHub runners are UTC, so
    between 22:00 and 24:00 UTC a run saw "yesterday" relative to the team,
    and countdowns computed there were a day off. The board is a South
    African calendar, so every script anchors to this instead.
    """
    return (now or datetime.now(timezone.utc)).astimezone(SAST).date()


def safe_urlopen(request: urllib.request.Request | str, timeout: float):
    """`urllib.request.urlopen` restricted to https (and http for loopback).

    Plain `urlopen` also opens `file://` and `ftp://` URLs. Several URLs here
    come from configuration or from data a pipeline wrote (the watchlist's
    page URLs, SUPABASE_URL), so a bad value would otherwise read local files
    or reach unintended hosts. Refusing other schemes up front closes that.
    """
    full_url = request if isinstance(request, str) else request.full_url
    parsed = urllib.parse.urlsplit(full_url)
    scheme = parsed.scheme.lower()
    if scheme == "https" or (scheme == "http" and parsed.hostname in _LOOPBACK_HOSTS):
        # The scheme was allow-listed on the line above, which is what B310 asks for.
        return urllib.request.urlopen(request, timeout=timeout)  # noqa: S310  # nosec B310
    raise ValueError(f"refusing to open non-https URL: {scheme or 'no scheme'}://{parsed.hostname or '?'}")
