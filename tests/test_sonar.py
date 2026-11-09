from __future__ import annotations

import argparse
import json
import re
from datetime import date

import pytest

import sonar

TODAY = date(2026, 11, 9)


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    monkeypatch.setattr(sonar, "today_sast", lambda: TODAY)


class TestParseDay:
    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ("2026-11-09", date(2026, 11, 9)),
            ("2026-11-09T09:00:00+02:00", date(2026, 11, 9)),
            ("deadline 2026-11-09 midnight", date(2026, 11, 9)),
        ],
    )
    def test_extracts_a_date(self, value, expected):
        assert sonar.parse_day(value) == expected

    @pytest.mark.parametrize("value", [None, 42, "", "soon", "2026-13-01", "2026-02-31", ["2026-11-09"]])
    def test_returns_none_for_anything_else(self, value):
        assert sonar.parse_day(value) is None


class TestNextDate:
    def test_picks_the_soonest_upcoming_date(self):
        h = {"dates": {"submission_deadline": "2026-12-01", "event_start": "2026-11-20"}}
        assert sonar.next_date(h) == ("event_start", date(2026, 11, 20))

    def test_ignores_dates_in_the_past(self):
        h = {"dates": {"submission_deadline": "2026-11-01", "event_start": "2026-12-05"}}
        assert sonar.next_date(h) == ("event_start", date(2026, 12, 5))

    def test_today_counts_as_upcoming(self):
        assert sonar.next_date({"dates": {"submission_deadline": "2026-11-09"}}) == (
            "submission_deadline",
            TODAY,
        )

    def test_none_when_nothing_is_ahead(self):
        assert sonar.next_date({"dates": {"submission_deadline": "2026-01-01"}}) is None
        assert sonar.next_date({"dates": {}}) is None
        assert sonar.next_date({}) is None

    def test_ignores_keys_it_does_not_know(self):
        assert sonar.next_date({"dates": {"judging": "2026-12-01", "winners_announced": "2026-12-02"}}) is None


class TestFmtPrize:
    def test_formats_a_pool_with_its_currency(self):
        assert sonar.fmt_prize({"prize": {"currency": "USD", "pool": 16500}}) == "USD 16,500"

    def test_tba_when_unknown_and_non_cash_when_stated(self):
        assert sonar.fmt_prize({}) == "TBA"
        assert sonar.fmt_prize({"prize": {"non_cash": [{"type": "other"}]}}) == "non-cash"


class TestScore:
    def run(self, capsys, career, win, prize, urgency):
        sonar.cmd_score(argparse.Namespace(career=career, win=win, prize=prize, urgency=urgency))
        out = capsys.readouterr().out
        score = float(re.search(r"score\D*([\d.]+)", out).group(1))
        tier = int(re.search(r"tier\D*(\d)", out).group(1))
        return score, tier

    @pytest.mark.parametrize(
        ("factors", "score", "tier"),
        [
            ((9, 4, 5, 10), 6.85, 2),
            ((5, 5, 4, 5), 4.80, 3),
            ((9, 9, 9, 9), 9.00, 1),
            ((0, 0, 0, 0), 0.00, 3),
        ],
    )
    def test_weighted_sum_and_tier(self, capsys, factors, score, tier):
        assert self.run(capsys, *factors) == (score, tier)

    def test_tier_boundaries_are_inclusive(self, capsys):
        # Documented in CONTRIBUTING: Tier 1 >= 7.0, Tier 2 6.0-6.9. Floating
        # point must not push an exact 7.0 or 6.0 into the tier below.
        assert self.run(capsys, 7, 7, 7, 7) == (7.00, 1)
        assert self.run(capsys, 6, 6, 6, 6) == (6.00, 2)


class TestIcsText:
    def test_escapes_the_characters_the_format_reserves(self):
        assert sonar.ics_escape("a,b;c\\d\ne") == r"a\,b\;c\\d\ne"

    def test_stringifies_non_strings(self):
        assert sonar.ics_escape(5) == "5"

    def test_short_lines_are_untouched(self):
        assert sonar.fold("SUMMARY:short") == ["SUMMARY:short"]

    def test_long_lines_fold_at_75_octets_and_reassemble(self):
        line = "DESCRIPTION:" + "word " * 60
        folded = sonar.fold(line)
        assert len(folded) > 1
        assert all(len(part.encode("utf-8")) <= 75 for part in folded)
        assert all(part.startswith(" ") for part in folded[1:])
        assert folded[0] + "".join(p[1:] for p in folded[1:]) == line

    def test_never_splits_a_multibyte_character(self):
        line = "SUMMARY:" + "é—→" * 40  # 2-3 bytes per character
        folded = sonar.fold(line)
        assert all(len(part.encode("utf-8")) <= 75 for part in folded)
        assert folded[0] + "".join(p[1:] for p in folded[1:]) == line


def write_events(tmp_path, events, tz="Africa/Johannesburg"):
    path = tmp_path / "events.json"
    path.write_text(json.dumps({"meta": {"timezone": tz}, "events": events}), encoding="utf-8")
    return path


class TestIcsFile:
    @pytest.fixture
    def ics(self, tmp_path, monkeypatch):
        events = [
            {"id": "deadline-one", "kind": "deadline", "summary": "DEADLINE: A, B; C", "start": "2026-11-11",
             "all_day": True, "reminders": [1440, 120], "description": "line one\nline two"},
            {"id": "multi-day", "kind": "reward", "summary": "Conference", "start": "2026-11-29",
             "end": "2026-12-04", "all_day": True},
            {"id": "timed", "kind": "event", "summary": "Workshop", "start": "2026-11-11T18:00",
             "end": "2026-11-11T21:00", "reminders": [60]},
            {"id": "weekly", "kind": "review", "summary": "Review", "start": "2026-08-10T08:00",
             "end": "2026-08-10T08:30", "rrule": "FREQ=WEEKLY;BYDAY=MO"},
            {"id": "long", "kind": "prep", "summary": "x" * 200, "start": "2026-11-12T09:00", "end": "2026-11-12T10:00"},
        ]
        monkeypatch.setattr(sonar, "CAL_EVENTS", str(write_events(tmp_path, events)))
        out = tmp_path / "out" / "cal.ics"
        sonar.cmd_ics(argparse.Namespace(output=str(out)))
        return out.read_bytes().decode("utf-8")

    def test_is_a_wellformed_calendar_with_crlf_line_endings(self, ics):
        assert ics.startswith("BEGIN:VCALENDAR\r\n")
        assert ics.endswith("END:VCALENDAR\r\n")
        assert "\n" not in ics.replace("\r\n", "")
        assert ics.count("BEGIN:VEVENT") == ics.count("END:VEVENT") == 5

    def test_no_line_exceeds_75_octets(self, ics):
        assert max(len(line.encode("utf-8")) for line in ics.split("\r\n")) <= 75

    def test_uids_are_unique_and_stable(self, ics):
        uids = re.findall(r"^UID:([^\r\n]+)", ics, re.M)
        assert uids == [f"{i}@sonar.hackathons" for i in ("deadline-one", "multi-day", "timed", "weekly", "long")]

    def test_all_day_events_use_dates_with_an_exclusive_end(self, ics):
        assert "DTSTART;VALUE=DATE:20261111" in ics
        assert "DTEND;VALUE=DATE:20261112" in ics  # one-day event ends the next day
        assert "DTSTART;VALUE=DATE:20261129" in ics
        assert "DTEND;VALUE=DATE:20261204" in ics

    def test_timed_events_carry_the_timezone(self, ics):
        assert "DTSTART;TZID=Africa/Johannesburg:20261111T180000" in ics
        assert "DTEND;TZID=Africa/Johannesburg:20261111T210000" in ics

    def test_text_is_escaped_and_reminders_become_alarms(self, ics):
        unfolded = ics.replace("\r\n ", "")
        assert r"SUMMARY:DEADLINE: A\, B\; C" in unfolded
        assert r"DESCRIPTION:line one\nline two" in unfolded
        assert "TRIGGER:-PT1440M" in ics and "TRIGGER:-PT120M" in ics and "TRIGGER:-PT60M" in ics

    def test_deadlines_do_not_block_time_but_events_do(self, ics):
        blocks = ics.split("BEGIN:VEVENT")[1:]
        transp = {re.search(r"UID:(.+?)@", b).group(1): re.search(r"TRANSP:(\w+)", b).group(1) for b in blocks}
        assert transp["deadline-one"] == "TRANSPARENT"
        assert transp["multi-day"] == "TRANSPARENT"
        assert transp["timed"] == "OPAQUE"

    def test_recurrence_rule_is_passed_through(self, ics):
        assert "RRULE:FREQ=WEEKLY;BYDAY=MO" in ics


class TestScoreTolerance:
    """Entries may carry a null or missing score (unscored, awaiting facts)."""

    @pytest.fixture
    def board(self, tmp_path, monkeypatch):
        entries = [
            {"id": "scored", "name": "Scored", "scope": "local", "score": 6.5, "tier": 2, "status": "open",
             "dates": {"submission_deadline": "2026-12-01", "confidence": "reported"}, "links": {"main": "https://a.example/"}},
            {"id": "null-score", "name": "Null score", "scope": "local", "score": None, "status": "verify",
             "dates": {"confidence": "unconfirmed"}, "links": {}},
            {"id": "no-score", "name": "No score", "scope": "local", "status": "verify", "dates": {}},
        ]
        path = tmp_path / "h.json"
        path.write_text(json.dumps({"meta": {}, "hackathons": entries}), encoding="utf-8")
        monkeypatch.setattr(sonar, "HACKATHONS", str(path))

    def test_list_does_not_crash(self, board, capsys):
        sonar.cmd_list(argparse.Namespace(tier=None, scope=None, status=None))
        out = capsys.readouterr().out
        assert "Scored" in out and "Null score" in out and "No score" in out

    def test_stale_does_not_crash(self, board, capsys):
        sonar.cmd_stale(argparse.Namespace())
        out = capsys.readouterr().out
        assert "Null score" in out and "No score" in out and "Scored" in out
