"""The scripts as a person or CI actually runs them: a real subprocess,
real exit codes, no mocks. These catch import errors, bad argument handling
and tracebacks that unit tests of single functions would miss."""

from __future__ import annotations

import os
import subprocess
import sys

import pytest
from conftest import SCRIPTS

ENV = {k: v for k, v in os.environ.items() if not k.startswith(("SUPABASE", "RADAR_SUPABASE", "GROQ"))}


def run(script, *args, env=None, timeout=60):
    return subprocess.run(  # noqa: S603 - fixed interpreter and repo paths
        [sys.executable, str(SCRIPTS / script), *args],
        capture_output=True, text=True, timeout=timeout, env=env or ENV, check=False,
    )


class TestSonarCli:
    @pytest.mark.parametrize("args", [["list"], ["next"], ["next", "--days", "90"], ["stale"], ["score", "--career", "8", "--win", "6", "--prize", "7", "--urgency", "9"]])
    def test_commands_run_cleanly(self, args):
        r = run("sonar.py", *args)
        assert r.returncode == 0, r.stderr
        assert "Traceback" not in r.stderr

    def test_ics_writes_a_calendar_to_the_requested_path(self, tmp_path):
        out = tmp_path / "x.ics"
        r = run("sonar.py", "ics", "--output", str(out))
        assert r.returncode == 0, r.stderr
        assert out.read_text(encoding="utf-8").startswith("BEGIN:VCALENDAR")

    def test_no_command_prints_usage_and_fails(self):
        r = run("sonar.py")
        assert r.returncode != 0
        assert "usage" in (r.stderr + r.stdout).lower()

    def test_rejects_a_missing_score_argument(self):
        assert run("sonar.py", "score", "--career", "8").returncode != 0


class TestPipelineScripts:
    def test_sync_check_needs_no_credentials_and_no_network(self):
        r = run("sync_radar.py", "check")
        assert r.returncode == 0, r.stderr
        assert "would sync" in r.stdout

    def test_sync_push_without_credentials_explains_what_is_missing(self):
        r = run("sync_radar.py", "push")
        assert r.returncode != 0
        assert "RADAR_SUPABASE_URL" in r.stderr
        assert "Traceback" not in r.stderr

    def test_sync_with_an_unknown_command_prints_usage(self):
        assert run("sync_radar.py", "frobnicate").returncode != 0

    def test_db_script_without_credentials_does_not_crash_with_a_traceback(self):
        r = run("sonar_db.py", "health")
        assert r.returncode != 0
        assert "SUPABASE_URL" in r.stderr
        assert "Traceback" not in r.stderr

    def test_watch_sources_without_credentials_does_not_crash(self):
        r = run("watch_sources.py", "--limit", "1")
        assert "Traceback" not in r.stderr

    def test_a_file_url_in_the_database_url_is_refused_not_opened(self):
        env = {**ENV, "RADAR_SUPABASE_URL": "file:///etc", "RADAR_SUPABASE_SERVICE_KEY": "x"}
        r = run("sync_radar.py", "push", env=env)
        assert r.returncode != 0
        assert "refusing to open non-https URL" in r.stderr
