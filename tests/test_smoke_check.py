"""The smoke test must fail when the site is broken, not only pass when it is
healthy. A tiny local server misbehaves in each way it is meant to catch."""

from __future__ import annotations

import http.server
import threading

import pytest
import smoke_check

GOOD_HEADERS = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "content-security-policy": "frame-ancestors 'self'",
    "strict-transport-security": "max-age=63072000",
}
HOME = '<html><title>SONAR</title><script src="/assets/app.js"></script></html>'


def make_handler(**quirks):
    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def reply(self, status, body="", headers=None, ctype="text/html"):
            data = body.encode()
            self.send_response(status)
            self.send_header("content-type", ctype)
            self.send_header("content-length", str(len(data)))
            for k, v in (headers or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            path = self.path
            if quirks.get("gate") and self.headers.get("x-vercel-protection-bypass") != quirks["gate"]:
                return self.reply(401, "Authentication Required")
            headers = {} if quirks.get("no_security_headers") else dict(GOOD_HEADERS)
            if path == "/assets/app.js":
                cache = "no-cache" if quirks.get("uncached_assets") else "public, max-age=31536000, immutable"
                return self.reply(200, "x=1", {"cache-control": cache}, "text/javascript")
            if path in ("/robots.txt", "/favicon.ico"):
                return self.reply(200, "ok", {}, "text/plain")
            if path in smoke_check.SECTIONS:
                if path == quirks.get("broken_section"):
                    return self.reply(500, "Internal Server Error", headers)
                body = "<html>no branding here</html>" if quirks.get("blank_page") else HOME
                return self.reply(200, body, headers)
            if quirks.get("soft_404"):
                return self.reply(200, HOME, headers)
            return self.reply(404, "not found", headers)

    return Handler


@pytest.fixture
def serve():
    servers = []

    def start(**quirks):
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), make_handler(**quirks))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        servers.append(server)
        return f"http://127.0.0.1:{server.server_address[1]}"

    yield start
    for s in servers:
        s.shutdown()
        s.server_close()


def failed(checks):
    return {c.name for c in checks if not c.ok}


def test_a_healthy_site_passes_everything(serve):
    checks = smoke_check.run_checks(serve())
    assert failed(checks) == set()
    assert len(checks) >= 25


def test_a_section_returning_500_is_caught(serve):
    bad = failed(smoke_check.run_checks(serve(broken_section="/stats")))
    assert "GET /stats -> 200" in bad
    assert "GET /stats has no server-error text" in bad
    assert "GET /radar -> 200" not in bad


def test_a_page_that_loads_but_is_blank_is_caught(serve):
    assert "GET /stats renders the app" in failed(smoke_check.run_checks(serve(blank_page=True)))


def test_an_unknown_path_that_returns_200_is_caught(serve):
    assert "unknown path is a real 404" in failed(smoke_check.run_checks(serve(soft_404=True)))


def test_missing_security_headers_are_caught(serve):
    bad = failed(smoke_check.run_checks(serve(no_security_headers=True)))
    assert {"header x-content-type-options", "header content-security-policy"} <= bad


def test_uncached_static_assets_are_caught(serve):
    assert "script bundle is cached long-term" in failed(smoke_check.run_checks(serve(uncached_assets=True)))


def test_a_protected_site_explains_the_bypass_instead_of_failing_cryptically(serve):
    checks = smoke_check.run_checks(serve(gate="s3cret"))
    assert len(checks) == 1 and not checks[0].ok
    assert "VERCEL_PROTECTION_BYPASS" in checks[0].detail


def test_the_bypass_secret_is_sent_as_a_header(serve):
    assert failed(smoke_check.run_checks(serve(gate="s3cret"), bypass="s3cret")) == set()


def test_main_exit_codes(serve, capsys, monkeypatch):
    monkeypatch.delenv("VERCEL_PROTECTION_BYPASS", raising=False)
    assert smoke_check.main([serve()]) == 0
    assert "checks passed" in capsys.readouterr().out
    assert smoke_check.main([serve(broken_section="/radar")]) == 1
    assert "FAIL" in capsys.readouterr().out


def test_refuses_to_probe_a_non_https_remote_host():
    with pytest.raises(ValueError, match="refusing"):
        smoke_check.fetch("http://example.com/")
