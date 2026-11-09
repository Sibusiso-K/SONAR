"""Checks on the repo's data files. These are what stop a bad edit, a
forgotten regeneration or a duplicate entry from reaching the live board."""

from __future__ import annotations

import argparse
import re
import urllib.parse
from datetime import date

import jsonschema
import pytest
from conftest import DATA, ROOT, read_json

import migrate_to_opportunities as mig
import sonar

ID_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
TRACKING = re.compile(r"(utm_|fbclid|gclid|[?&]_gl=|[?&]_ga=|ref_feature|ref_medium|mc_cid|igshid)", re.I)

# Entries written before the schema's `prize` block was tightened. Their prize
# data is shaped as {"1st": 25000} or free text where the schema wants arrays
# of objects. This is known debt, not an exemption for new work: any entry NOT
# listed here must validate, and an entry that is fixed must be removed from
# this list (test_the_debt_list_only_shrinks fails otherwise).
LEGACY_SCHEMA_DEBT = frozenset(
    {
        "adtc-2026", "ai-infra-summit-hackathon-2026", "bcg-platinion-2026", "entelect-university-cup-2027",
        "fnb-aoty-2026", "govtech-2026", "huawei-ict-2026-2027", "ibm-devday-bob-2026", "ibm-z-datathon-2026",
        "kaggle-gemma4-agent-paper-2026", "life-after-code-gitlab-2026", "meta-global-ai-dev-hackathon-2026",
        "mintek-sci-2026", "mtn-momo-miniapp-2026", "nasa-space-apps-2026", "nebius-nvidia-global-ai-hackathon-2026",
        "nedbank-youthx-awards-2026", "paypal-ai-hackathon-2026", "qloo-agentic-hackathon-2026", "rsna-knee-2026",
        "shipaton-2026", "sme-toolkit-business-plan-2026", "unesco-youth-2026", "w3node-hackathon-2026",
        "wbg-small-ai-development-2026", "wits-ehub-tech-ai-day-2026", "zindi-rolling",
    }
)

# `links` values that are an email address or a sentence rather than a URL.
# Same rule: do not add to this list; fix the entry instead.
LEGACY_NON_URL_LINKS = frozenset(
    {
        ("bcg-platinion-2026", "contact"),
        ("wits-ehub-tech-ai-day-2026", "main"),
        ("wits-ehub-tech-ai-day-2026", "contact_older_ehub_page"),
    }
)


def entries(hackathons):
    return hackathons["hackathons"]


class TestFilesParse:
    @pytest.mark.parametrize("path", sorted(DATA.glob("*.json")), ids=lambda p: p.name)
    def test_every_data_file_is_valid_json(self, path):
        assert read_json(path) is not None

    def test_schema_file_is_itself_a_valid_schema(self, schema):
        jsonschema.Draft202012Validator.check_schema(schema)


class TestEntries:
    def test_ids_are_unique_and_kebab_case(self, hackathons):
        ids = [h["id"] for h in entries(hackathons)]
        assert len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1]
        assert [i for i in ids if not ID_PATTERN.match(i)] == []

    def test_no_two_entries_share_a_main_link(self, hackathons):
        # Catches the same event added twice under two ids.
        seen: dict[str, str] = {}
        for h in entries(hackathons):
            url = (h.get("links") or {}).get("main")
            if not url or not url.startswith("http"):
                continue
            # A bare homepage (https://entelect.co.za/) is shared by an
            # organiser's different events; only a specific page identifies one.
            if urllib.parse.urlsplit(url).path.strip("/") == "":
                continue
            key = url.rstrip("/").lower()
            assert key not in seen, f"{h['id']} and {seen[key]} both link to {url}"
            seen[key] = h["id"]

    def test_no_two_entries_share_a_name(self, hackathons):
        names = [re.sub(r"[^a-z0-9]", "", h["name"].lower()) for h in entries(hackathons)]
        assert len(names) == len(set(names))

    def test_stored_scores_match_the_weighted_sub_scores(self, hackathons):
        weights = hackathons["meta"]["scoring_weights"]
        for h in entries(hackathons):
            if isinstance(h.get("score"), (int, float)) and h.get("scores"):
                want = round(sum((h["scores"].get(k) or 0) * w for k, w in weights.items()), 2)
                assert h["score"] == pytest.approx(want, abs=0.001), h["id"]

    def test_scored_entries_have_a_tier_that_matches_their_score(self, hackathons):
        for h in entries(hackathons):
            if isinstance(h.get("score"), (int, float)) and h.get("tier"):
                expected = 1 if h["score"] >= 7.0 else 2 if h["score"] >= 6.0 else 3
                assert h["tier"] == expected, f"{h['id']}: score {h['score']} implies tier {expected}"

    def test_every_confidence_is_one_of_the_documented_levels(self, hackathons):
        allowed = set(hackathons["meta"]["confidence_levels"])
        for h in entries(hackathons):
            assert h.get("dates", {}).get("confidence") in allowed, h["id"]

    def test_every_date_value_that_looks_like_a_date_is_a_real_date(self, hackathons):
        for h in entries(hackathons):
            for key, value in (h.get("dates") or {}).items():
                if key in ("confidence", "note") or not isinstance(value, str):
                    continue
                match = re.match(r"(\d{4})-(\d{2})-(\d{2})", value)
                if match:
                    date(int(match[1]), int(match[2]), int(match[3]))  # raises on 2026-02-31

    def test_links_carry_no_tracking_parameters(self, hackathons):
        for h in entries(hackathons):
            for key, value in (h.get("links") or {}).items():
                assert not TRACKING.search(str(value)), f"{h['id']}.{key}: {value}"

    def test_links_are_https_urls(self, hackathons):
        bad = [
            (h["id"], k)
            for h in entries(hackathons)
            for k, v in (h.get("links") or {}).items()
            if not str(v).startswith("https://") and (h["id"], k) not in LEGACY_NON_URL_LINKS
        ]
        assert bad == [], "links must be https URLs (move emails and notes elsewhere)"


class TestSchema:
    @staticmethod
    def invalid_ids(schema, hackathons):
        validator = jsonschema.Draft202012Validator(schema)
        return {h["id"] for h in entries(hackathons) if list(validator.iter_errors(h))}

    def test_every_entry_outside_the_debt_list_validates(self, schema, hackathons):
        new_problems = self.invalid_ids(schema, hackathons) - LEGACY_SCHEMA_DEBT
        validator = jsonschema.Draft202012Validator(schema)
        detail = {
            h["id"]: [f"{list(e.path)}: {e.message[:80]}" for e in validator.iter_errors(h)][:3]
            for h in entries(hackathons)
            if h["id"] in new_problems
        }
        assert not new_problems, f"entries do not match schema/hackathon.schema.json: {detail}"

    def test_the_debt_list_only_shrinks(self, schema, hackathons):
        fixed = LEGACY_SCHEMA_DEBT - self.invalid_ids(schema, hackathons)
        assert not fixed, f"now valid: remove {sorted(fixed)} from LEGACY_SCHEMA_DEBT"

    def test_the_debt_list_names_only_real_entries(self, hackathons):
        assert {h["id"] for h in entries(hackathons)} >= LEGACY_SCHEMA_DEBT

    def test_kinds_used_are_in_the_schema(self, schema, hackathons):
        allowed = set(schema["properties"]["kind"]["enum"])
        used = {h["kind"] for h in entries(hackathons) if "kind" in h}
        assert used <= allowed, used - allowed


class TestCalendar:
    def test_event_ids_are_unique(self, calendar_events):
        ids = [e["id"] for e in calendar_events["events"]]
        assert len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1]

    def test_kinds_are_documented(self, calendar_events):
        allowed = set(calendar_events["meta"]["kinds"])
        assert {e["kind"] for e in calendar_events["events"]} <= allowed

    def test_starts_and_ends_are_well_formed_and_ordered(self, calendar_events):
        for e in calendar_events["events"]:
            pattern = r"^\d{4}-\d{2}-\d{2}$" if e.get("all_day") else r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$"
            assert re.match(pattern, e["start"]), f"{e['id']}: bad start {e['start']!r}"
            if e.get("end"):
                assert re.match(pattern, e["end"]), f"{e['id']}: bad end {e['end']!r}"
                assert e["end"] >= e["start"], f"{e['id']} ends before it starts"

    def test_reminders_are_positive_minutes(self, calendar_events):
        for e in calendar_events["events"]:
            assert all(isinstance(m, int) and m >= 0 for m in e.get("reminders", [])), e["id"]

    def test_every_event_has_a_summary(self, calendar_events):
        assert all(e.get("summary", "").strip() for e in calendar_events["events"])


class TestDerivedFilesAreFresh:
    """opportunities.json and the .ics are generated. A PR that edits the
    source and forgets to regenerate would ship a stale board; the nightly job
    only commits when its own sync step succeeds, which it did not for weeks."""

    VOLATILE = {"generated", "days_remaining", "next_date", "next_date_label"}

    @staticmethod
    def strip(obj, volatile):
        if isinstance(obj, dict):
            return {k: TestDerivedFilesAreFresh.strip(v, volatile) for k, v in obj.items() if k not in volatile}
        if isinstance(obj, list):
            return [TestDerivedFilesAreFresh.strip(v, volatile) for v in obj]
        return obj

    def test_opportunities_json_matches_hackathons_json(self, tmp_path, monkeypatch, capsys):
        regenerated = tmp_path / "opportunities.json"
        monkeypatch.setattr(mig, "OUT", str(regenerated))
        mig.main()
        capsys.readouterr()
        fresh = self.strip(read_json(regenerated), self.VOLATILE)
        committed = self.strip(read_json(DATA / "opportunities.json"), self.VOLATILE)
        assert [o["id"] for o in committed["opportunities"]] == [o["id"] for o in fresh["opportunities"]], (
            "data/opportunities.json is out of date: run `make data`"
        )
        assert committed == fresh, "data/opportunities.json is out of date: run `make data`"

    def test_ics_matches_calendar_events_json(self, tmp_path):
        out = tmp_path / "sonar.ics"
        sonar.cmd_ics(argparse.Namespace(output=str(out)))

        def body(path):
            return [ln for ln in path.read_text(encoding="utf-8").splitlines() if not ln.startswith("DTSTAMP:")]

        assert body(out) == body(ROOT / "calendar" / "sonar-2026.ics"), (
            "calendar/sonar-2026.ics is out of date: run `make data`"
        )
