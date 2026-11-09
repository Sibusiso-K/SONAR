from __future__ import annotations

import io
import json
import urllib.error

import pytest

import sync_radar as sr


class TestSlugify:
    def test_lowercases_and_collapses_punctuation(self):
        assert sr.slugify("Discovery  Gradhack: 2026!") == "discovery-gradhack-2026"

    def test_never_returns_an_empty_id(self):
        assert sr.slugify("!!!") == "untitled"


class TestToRadarOpportunity:
    base = {"id": "x", "name": "X", "status": "open", "score": 6.5, "tier": 2,
            "scores": {"career_leverage": 7, "winnability": 6, "prize": 5, "urgency": 8}}

    def test_scales_scores_from_0_10_to_0_100(self):
        row = sr.to_radar_opportunity(self.base)
        assert row["score"] == 65.0
        assert row["scores"] == {"career_leverage": 70, "winnability": 60, "prize": 50, "urgency": 80}

    def test_fills_defaults_instead_of_nulls_for_required_columns(self):
        row = sr.to_radar_opportunity({"id": "x", "name": "X"})
        assert (row["organiser"], row["kind"], row["format"], row["scope"]) == ("Unknown", "hackathon", "online", "local")
        assert row["tier"] == 3 and row["score"] == 0 and row["confidence"] == "unconfirmed"
        assert row["source"] == "manual research"

    def test_joins_a_deliverables_list_into_text(self):
        row = sr.to_radar_opportunity({**self.base, "deliverables": ["repo", "video"]})
        assert row["deliverables"] == "repo\nvideo"

    @pytest.mark.parametrize("status", ["past", "closed", "dropped"])
    def test_finished_or_abandoned_entries_are_archived(self, status):
        assert sr.to_radar_opportunity({**self.base, "status": status})["archived"] is True

    @pytest.mark.parametrize("status", ["open", "closing", "verify", "monitor", "registered", "selected", "submitted", None])
    def test_everything_else_stays_on_the_live_board(self, status):
        assert sr.to_radar_opportunity({**self.base, "status": status})["archived"] is False


class TestToRadarPast:
    def test_missed_and_placed_are_recorded(self):
        used = set()
        missed = sr.to_radar_past({"name": "Gradhack", "missed": True, "reason": "MISSED. late"}, used)
        placed = sr.to_radar_past({"name": "Cup", "result": "Top 6", "reason": "ok"}, used)
        assert missed["outcome"] == "missed" and placed["outcome"] == "placed"
        assert placed["placement"] == "Top 6"

    def test_an_entry_with_no_engagement_signal_is_not_invented_as_entered(self):
        assert sr.to_radar_past({"name": "Existed", "reason": "diarise for next year"}, set()) is None

    def test_duplicate_names_get_distinct_ids(self):
        used = set()
        a = sr.to_radar_past({"name": "Same", "missed": True}, used)
        b = sr.to_radar_past({"name": "Same", "missed": True}, used)
        assert (a["id"], b["id"]) == ("same", "same-2")

    def test_a_correction_in_the_reason_is_flagged(self):
        row = sr.to_radar_past({"name": "N", "missed": True, "reason": "Correction logged 11 Aug"}, set())
        assert row["corrected"] is True and "Correction" in row["correction_note"]


class TestToRadarUpdate:
    update = {"at": "2026-11-09T10:00:00Z", "target": "x", "title": "Added x", "by": "Sibusiso K", "kind": "discovery"}

    def test_id_is_deterministic_so_resyncs_do_not_duplicate(self):
        assert sr.to_radar_update(self.update)["id"] == sr.to_radar_update(dict(self.update))["id"]

    def test_different_content_gets_a_different_id(self):
        assert sr.to_radar_update(self.update)["id"] != sr.to_radar_update({**self.update, "title": "Other"})["id"]

    def test_humans_and_automation_are_told_apart(self):
        assert sr.to_radar_update(self.update)["actor_kind"] == "human"
        assert sr.to_radar_update({**self.update, "by": "bot"})["actor_kind"] == "automated"
        assert sr.to_radar_update({k: v for k, v in self.update.items() if k != "by"})["actor"] == "verification pipeline"

    def test_unknown_kinds_become_notes(self):
        assert sr.to_radar_update({**self.update, "kind": "???"})["change_kind"] == "note"


@pytest.fixture(scope="module")
def rows():
    return sr.build_rows()


class TestPipelineContract:
    """The rows pushed to the live database must match the columns the web
    app's generated types declare, or the site breaks on the next deploy."""

    @staticmethod
    def db_columns(root, table):
        import re

        text = (root / "web" / "src" / "integrations" / "supabase" / "types.ts").read_text(encoding="utf-8")
        block = re.search(r"\n      " + table + r": \{\n        Row: \{(.*?)\n        \}", text, re.S).group(1)
        return set(re.findall(r"^\s+(\w+)\??:", block, re.M))

    def test_opportunities_have_exactly_the_columns_the_site_reads(self, rows, root):
        server_default = {"created_at"}
        assert set(rows[0][0]) == self.db_columns(root, "opportunities") - server_default

    def test_past_entries_match_their_table(self, rows, root):
        assert set(rows[1][0]) == self.db_columns(root, "past_opportunities") - {"created_at"}

    def test_audit_entries_match_their_table(self, rows, root):
        assert set(rows[2][0]) == self.db_columns(root, "updates")

    def test_ids_are_unique(self, rows):
        for table in rows:
            ids = [r["id"] for r in table]
            assert len(ids) == len(set(ids))

    def test_values_are_in_the_ranges_the_ui_assumes(self, rows):
        for r in rows[0]:
            assert 0 <= r["score"] <= 100
            assert r["tier"] in (1, 2, 3)
            assert isinstance(r["archived"], bool)
            assert all(0 <= v <= 100 for v in r["scores"].values())


class DeletionRecorder:
    """Stands in for rest(): serves an `existing` id list and records DELETEs."""

    def __init__(self, existing):
        self.existing = existing
        self.deletes = []

    def __call__(self, method, path, body=None, params=None, prefer=None, fatal=True):
        if method == "GET":
            return [{"id": i} for i in self.existing]
        self.deletes.append((method, path, params))
        return []


class TestDeleteNotInGuard:
    existing = [f"e{i}" for i in range(10)]

    def test_deletes_only_what_is_missing(self, monkeypatch):
        rec = DeletionRecorder(self.existing)
        monkeypatch.setattr(sr, "rest", rec)
        sr.delete_not_in("opportunities", self.existing[:9])
        assert rec.deletes == [("DELETE", "opportunities", {"id": 'in.("e9")'})]

    def test_refuses_to_wipe_most_of_the_table(self, monkeypatch):
        rec = DeletionRecorder(self.existing)
        monkeypatch.setattr(sr, "rest", rec)
        with pytest.raises(SystemExit, match="refusing to delete 7 of 10"):
            sr.delete_not_in("opportunities", self.existing[:3])
        assert rec.deletes == []

    def test_exactly_half_is_allowed_more_than_half_is_not(self, monkeypatch):
        rec = DeletionRecorder(self.existing)
        monkeypatch.setattr(sr, "rest", rec)
        sr.delete_not_in("opportunities", self.existing[:5])  # 5 of 10 = 50%
        assert len(rec.deletes) == 1
        with pytest.raises(SystemExit):
            sr.delete_not_in("opportunities", self.existing[:4])  # 6 of 10

    def test_small_tables_are_not_guarded(self, monkeypatch):
        rec = DeletionRecorder(["a", "b", "c"])
        monkeypatch.setattr(sr, "rest", rec)
        sr.delete_not_in("past_opportunities", ["a"])  # removes 2 of 3
        assert len(rec.deletes) == 1

    def test_an_empty_source_list_does_nothing_at_all(self, monkeypatch):
        rec = DeletionRecorder(self.existing)
        monkeypatch.setattr(sr, "rest", rec)
        sr.delete_not_in("opportunities", [])
        assert rec.deletes == []

    def test_nothing_to_delete_issues_no_request(self, monkeypatch):
        rec = DeletionRecorder(self.existing)
        monkeypatch.setattr(sr, "rest", rec)
        sr.delete_not_in("opportunities", self.existing)
        assert rec.deletes == []


class FakeResponse:
    def __init__(self, body=b"[]"):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self):
        return self.body


class TestRest:
    @pytest.fixture
    def configured(self, monkeypatch):
        monkeypatch.setattr(sr, "URL", "https://project.supabase.co")
        monkeypatch.setattr(sr, "KEY", "service-key")
        monkeypatch.setattr(sr, "SCHEMA", "")

    def test_exits_with_guidance_when_credentials_are_missing(self, monkeypatch):
        monkeypatch.setattr(sr, "URL", "")
        monkeypatch.setattr(sr, "KEY", "")
        with pytest.raises(SystemExit, match="RADAR_SUPABASE_URL"):
            sr.rest("GET", "opportunities")

    def test_sends_the_key_and_parses_json(self, configured, monkeypatch):
        seen = {}
        monkeypatch.setattr(sr, "safe_urlopen", lambda req, timeout: seen.update(req=req) or FakeResponse(b'[{"id": 1}]'))
        assert sr.rest("GET", "opportunities", params={"select": "id"}) == [{"id": 1}]
        req = seen["req"]
        assert req.full_url == "https://project.supabase.co/rest/v1/opportunities?select=id"
        assert req.get_header("Apikey") == "service-key"
        assert req.get_header("Authorization") == "Bearer service-key"

    def test_targets_another_schema_when_asked(self, configured, monkeypatch):
        monkeypatch.setattr(sr, "SCHEMA", "app")
        seen = {}
        monkeypatch.setattr(sr, "safe_urlopen", lambda req, timeout: seen.update(req=req) or FakeResponse())
        sr.rest("GET", "opportunities")
        assert seen["req"].get_header("Accept-profile") == "app"
        assert seen["req"].get_header("Content-profile") == "app"

    def test_an_empty_body_is_an_empty_list(self, configured, monkeypatch):
        monkeypatch.setattr(sr, "safe_urlopen", lambda req, timeout: FakeResponse(b"  "))
        assert sr.rest("DELETE", "x") == []

    def test_refuses_a_non_https_database_url(self, monkeypatch):
        monkeypatch.setattr(sr, "URL", "file:///etc")
        monkeypatch.setattr(sr, "KEY", "k")
        with pytest.raises(ValueError, match="refusing"):
            sr.rest("GET", "x")

    @staticmethod
    def http_error(code):
        return urllib.error.HTTPError("u", code, "msg", {}, io.BytesIO(b'{"message": "nope"}'))

    def test_http_errors_stop_the_sync_with_the_server_message(self, configured, monkeypatch):
        def boom(req, timeout):
            raise self.http_error(500)

        monkeypatch.setattr(sr, "safe_urlopen", boom)
        with pytest.raises(SystemExit, match="500"):
            sr.rest("GET", "x")

    def test_a_permission_error_can_be_tolerated_by_the_caller(self, configured, monkeypatch):
        def boom(req, timeout):
            raise self.http_error(403)

        monkeypatch.setattr(sr, "safe_urlopen", boom)
        with pytest.raises(PermissionError) as exc:
            sr.rest("DELETE", "updates", fatal=False)
        assert isinstance(exc.value.__cause__, urllib.error.HTTPError)


def test_check_command_reports_without_touching_the_network(capsys):
    sr.cmd_check([])
    out = capsys.readouterr().out
    assert "would sync" in out and "opportunities" in out


def test_fixture_exporter_writes_what_build_rows_returns(tmp_path, root):
    import export_radar_fixture

    out = tmp_path / "board.json"
    assert export_radar_fixture.main(["export", str(out)]) == 0
    data = json.loads(out.read_text(encoding="utf-8"))
    opps, past, updates = sr.build_rows()
    assert [len(data[k]) for k in ("opportunities", "past_opportunities", "updates")] == [len(opps), len(past), len(updates)]
    assert export_radar_fixture.main(["export"]) == 2
