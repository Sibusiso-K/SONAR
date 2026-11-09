from __future__ import annotations

import json
from datetime import date

import pytest

import migrate_to_opportunities as mig

TODAY = date(2026, 11, 9)
WEIGHTS = {"career_leverage": 0.35, "winnability": 0.30, "prize": 0.20, "urgency": 0.15}


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    monkeypatch.setattr(mig, "today_sast", lambda: TODAY)


def entry(**over):
    e = {
        "id": "demo-2026", "name": "Demo", "organiser": "Org", "scope": "local", "status": "open",
        "tier": 2, "score": 6.0, "scores": {"career_leverage": 6, "winnability": 6, "prize": 6, "urgency": 6},
        "dates": {"submission_deadline": "2026-11-20", "confidence": "confirmed"}, "links": {"main": "https://x.example/"},
    }
    e.update(over)
    return e


def run(tmp_path, monkeypatch, hackathons, past=()):
    src = tmp_path / "hackathons.json"
    out = tmp_path / "opportunities.json"
    src.write_text(
        json.dumps({"meta": {"scoring_weights": WEIGHTS}, "hackathons": list(hackathons),
                    "dropped_or_past": list(past), "monitoring_sources": []}),
        encoding="utf-8",
    )
    monkeypatch.setattr(mig, "SRC", str(src))
    monkeypatch.setattr(mig, "OUT", str(out))
    mig.main()
    return json.loads(out.read_text(encoding="utf-8"))


class TestNextDate:
    def test_returns_label_and_iso_date(self):
        assert mig.next_date(entry()) == ("submission_deadline", "2026-11-20")

    def test_skips_the_past_and_handles_nothing_ahead(self):
        assert mig.next_date({"dates": {"submission_deadline": "2026-11-01"}}) == (None, None)

    def test_parse_day_rejects_short_and_invalid_values(self):
        assert mig.parse_day("2026") is None
        assert mig.parse_day("2026-02-31") is None
        assert mig.parse_day(None) is None


class TestMain:
    def test_carries_fields_through_and_adds_derived_ones(self, tmp_path, monkeypatch):
        board = run(tmp_path, monkeypatch, [entry()])
        o = board["opportunities"][0]
        assert o["id"] == "demo-2026"
        assert o["next_date"] == "2026-11-20"
        assert o["days_remaining"] == 11
        assert o["confidence"] == "confirmed"
        assert o["kind"] == "hackathon"
        assert o["career_track"] == "none"

    def test_an_entry_states_its_own_kind_over_the_lookup_table(self, tmp_path, monkeypatch):
        # bcg-platinion-2026 is "recruiting_event" in the fallback table.
        board = run(tmp_path, monkeypatch, [entry(id="bcg-platinion-2026", kind="fellowship")])
        assert board["opportunities"][0]["kind"] == "fellowship"

    def test_falls_back_to_the_table_for_entries_without_a_kind(self, tmp_path, monkeypatch):
        board = run(tmp_path, monkeypatch, [entry(id="bcg-platinion-2026")])
        assert board["opportunities"][0]["kind"] == "recruiting_event"

    @pytest.mark.parametrize(
        ("status", "tier", "lifecycle"),
        [
            ("open", 1, "committed"),
            ("open", 2, "scored"),
            ("closing", 3, "scored"),
            ("monitor", 3, "triaged"),
            ("monitor-weekly", 3, "triaged"),
            ("verify", 3, "discovered"),
            ("registered", 3, "committed"),
            ("selected", 1, "committed"),
            ("submitted", 2, "submitted"),
            ("past", 2, "judged"),
            ("closed", 2, "judged"),
        ],
    )
    def test_lifecycle_reflects_our_state_not_just_the_competitions(self, tmp_path, monkeypatch, status, tier, lifecycle):
        board = run(tmp_path, monkeypatch, [entry(status=status, tier=tier)])
        assert board["opportunities"][0]["lifecycle"] == lifecycle

    def test_a_drifted_total_score_fails_the_build(self, tmp_path, monkeypatch, capsys):
        # scores average 6.0 but the stored total says 9.9: one of them is stale.
        with pytest.raises(SystemExit) as exc:
            run(tmp_path, monkeypatch, [entry(score=9.9)])
        assert exc.value.code == 1
        assert "demo-2026" in capsys.readouterr().out

    def test_unscored_entries_are_not_flagged_as_drift(self, tmp_path, monkeypatch):
        e = entry()
        del e["score"], e["scores"], e["tier"]
        board = run(tmp_path, monkeypatch, [e])
        assert board["opportunities"][0]["id"] == "demo-2026"

    def test_past_entries_keep_a_two_sentence_summary_and_the_missed_flag(self, tmp_path, monkeypatch):
        past = [
            {"name": "Missed", "reason": "MISSED — Registration closed. We never saw it. Third sentence here."},
            {"name": "Kept", "reason": "Held in March. Result: placed.", "result": "Top 6"},
        ]
        board = run(tmp_path, monkeypatch, [entry()], past)
        missed, kept = board["past"]
        assert missed["missed"] is True
        assert missed["summary"] == "Registration closed. We never saw it."
        assert kept["missed"] is False and kept["result"] == "Top 6"

    def test_documents_every_kind_it_can_emit(self, tmp_path, monkeypatch):
        meta = run(tmp_path, monkeypatch, [entry()])["meta"]["kinds"]
        for kind in ("hackathon", "fellowship", "grant", "startup_competition", "programme"):
            assert kind in meta
