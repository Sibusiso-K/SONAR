from __future__ import annotations

import urllib.request
from datetime import date, datetime, timezone

import pytest

import _common


class TestTodaySast:
    def test_reads_a_johannesburg_wall_clock_not_utc(self):
        # 22:30 UTC is 00:30 the next day in South Africa (UTC+2).
        assert _common.today_sast(datetime(2026, 11, 9, 22, 30, tzinfo=timezone.utc)) == date(2026, 11, 10)
        assert _common.today_sast(datetime(2026, 11, 9, 21, 59, tzinfo=timezone.utc)) == date(2026, 11, 9)

    def test_defaults_to_now(self):
        assert isinstance(_common.today_sast(), date)

    def test_offset_is_exactly_two_hours_all_year(self):
        # South Africa has no daylight saving, so a fixed offset is exact.
        for month in (1, 6, 12):
            at = datetime(2026, month, 15, 12, 0, tzinfo=timezone.utc)
            assert at.astimezone(_common.SAST).utcoffset().total_seconds() == 7200


class TestSafeUrlopen:
    @pytest.fixture
    def opened(self, monkeypatch):
        calls = []
        monkeypatch.setattr(_common.urllib.request, "urlopen", lambda req, timeout: calls.append((req, timeout)) or "ok")
        return calls

    def test_allows_https(self, opened):
        assert _common.safe_urlopen("https://example.com/x", 5) == "ok"
        assert opened == [("https://example.com/x", 5)]

    def test_accepts_a_request_object(self, opened):
        req = urllib.request.Request("https://example.com/", method="GET")  # noqa: S310 - never opened here
        assert _common.safe_urlopen(req, 3) == "ok"

    @pytest.mark.parametrize("host", ["localhost", "127.0.0.1"])
    def test_allows_plain_http_to_loopback_only(self, opened, host):
        assert _common.safe_urlopen(f"http://{host}:54321/rest/v1/x", 5) == "ok"

    @pytest.mark.parametrize(
        "url",
        [
            "http://example.com/",  # plain http to a real host
            "file:///etc/passwd",
            "ftp://example.com/file",
            "gopher://example.com/",
            "data:text/plain,hi",
            "//example.com/x",
            "example.com",
            "",
        ],
    )
    def test_refuses_everything_else(self, opened, url):
        with pytest.raises(ValueError, match="refusing"):
            _common.safe_urlopen(url, 5)
        assert opened == []

    def test_scheme_check_is_case_insensitive(self, opened):
        assert _common.safe_urlopen("HTTPS://example.com/", 5) == "ok"
        with pytest.raises(ValueError):
            _common.safe_urlopen("FILE:///etc/passwd", 5)
