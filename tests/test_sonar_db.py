from __future__ import annotations

import io
import urllib.error
from datetime import date

import pytest

import sonar_db as db

TODAY = date(2026, 11, 9)


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    monkeypatch.setattr(db, "today_sast", lambda: TODAY)


def edition(year, **fields):
    return {"opportunity_slug": "demo", "year": year, **fields}


class TestNormalizeName:
    def test_ignores_case_spacing_and_punctuation(self):
        assert db._normalize_name("GKHack26") == db._normalize_name("GK Hack-26")
        assert db._normalize_name("  Gradhack: 2026! ") == "gradhack2026"

    def test_does_not_merge_different_years(self):
        assert db._normalize_name("Gradhack 2026") != db._normalize_name("Gradhack 2027")

    def test_none_is_empty(self):
        assert db._normalize_name(None) == ""


class TestCircularMean:
    def test_dates_around_new_year_average_to_new_year_not_midsummer(self):
        mean, spread = db._circular_mean_doy([360, 5])
        # The plain average (182) is half a year away from the truth.
        assert min(mean, 365 - mean) < 6
        assert spread < 10

    def test_identical_dates_have_no_spread(self):
        mean, spread = db._circular_mean_doy([200, 200, 200])
        assert round(mean) == 200 and spread == pytest.approx(0, abs=0.5)

    def test_spread_grows_with_disagreement(self):
        assert db._circular_mean_doy([100, 200, 300])[1] > db._circular_mean_doy([100, 105, 110])[1]


class TestForecast:
    def test_one_edition_is_an_anecdote_not_a_season(self):
        assert db.forecast_from_editions([edition(2025, event_start="2025-08-07")]) == []

    def test_two_editions_predict_the_next_window(self):
        preds = db.forecast_from_editions(
            [edition(2024, event_start="2024-08-05"), edition(2025, event_start="2025-08-09")]
        )
        assert len(preds) == 1
        p = preds[0]
        assert p["n_editions"] == 2 and p["method"] == "seasonal_mean"
        # Next edition is 2026 or later, in early August, with an announcement before it.
        assert p["predicted_event_start"] <= "2026-08-12" and p["predicted_event_end"] >= "2026-08-01"
        assert p["predicted_announce_start"] < p["predicted_event_start"]

    def test_never_predicts_a_year_already_in_the_past(self):
        preds = db.forecast_from_editions([edition(2020, event_start="2020-03-01"), edition(2021, event_start="2021-03-01")])
        assert preds[0]["predicted_event_start"].startswith("2026")

    def test_confidence_is_capped_so_a_prediction_never_looks_confirmed(self):
        eds = [edition(y, event_start=f"{y}-08-07") for y in range(2020, 2026)]
        assert db.forecast_from_editions(eds)[0]["confidence"] <= 0.8

    def test_a_closing_date_stands_in_for_a_missing_event_date_per_edition(self):
        # Edition 2025 only ever recorded a deadline. It must still count.
        eds = [edition(2024, event_start="2024-08-05"), edition(2025, closes_on="2025-08-09")]
        assert db.forecast_from_editions(eds)[0]["n_editions"] == 2

    def test_unparseable_dates_are_ignored_not_fatal(self):
        eds = [edition(2024, event_start="not a date"), edition(2025, event_start="2025-08-09"), edition(2026, event_start="2026-08-08")]
        assert db.forecast_from_editions(eds)[0]["n_editions"] == 2

    def test_slugs_are_forecast_independently(self):
        eds = [
            {"opportunity_slug": "a", "year": 2024, "event_start": "2024-03-01"},
            {"opportunity_slug": "a", "year": 2025, "event_start": "2025-03-01"},
            {"opportunity_slug": "b", "year": 2025, "event_start": "2025-09-01"},
        ]
        assert [p["opportunity_slug"] for p in db.forecast_from_editions(eds)] == ["a"]


class TestLeadTimePairing:
    """Regression: announcement and event dates were filtered into two
    separate lists and zipped, so a year's announcement could be paired with
    a different year's event whenever some editions lacked one of the fields."""

    def test_pairs_dates_within_the_same_edition(self):
        rows = [
            edition(2023, announced_on="2023-06-01", event_start="2023-08-10"),  # 70 days
            edition(2024, event_start="2024-08-12"),  # no announcement recorded
            edition(2025, announced_on="2025-06-20", event_start="2025-08-09"),  # 50 days
        ]
        assert sorted(db._observed_leads(rows)) == [50, 70]

    def test_ignores_non_positive_leads(self):
        assert db._observed_leads([edition(2025, announced_on="2025-08-10", event_start="2025-08-09")]) == []

    def test_does_not_pair_an_announcement_with_another_years_event(self):
        rows = [
            edition(2024, announced_on="2024-06-01"),  # announcement only
            edition(2025, event_start="2025-08-09"),  # event only
        ]
        assert db._observed_leads(rows) == []

    def test_the_forecast_uses_the_observed_lead_and_says_so(self):
        eds = [
            edition(2024, announced_on="2024-06-01", event_start="2024-08-10"),
            edition(2025, announced_on="2025-06-01", event_start="2025-08-10"),
        ]
        assert "median observed lead 70d" in db.forecast_from_editions(eds)[0]["basis"]

    def test_falls_back_to_an_assumed_lead_and_says_so(self):
        eds = [edition(2024, event_start="2024-08-10"), edition(2025, event_start="2025-08-10")]
        assert "assumed 6-week lead" in db.forecast_from_editions(eds)[0]["basis"]


class TestRest:
    def test_http_errors_become_rest_errors_chained_to_their_cause(self, monkeypatch):
        monkeypatch.setattr(db, "URL", "https://project.supabase.co")
        monkeypatch.setattr(db, "KEY", "k")

        def boom(req, timeout):
            raise urllib.error.HTTPError("u", 409, "conflict", {}, io.BytesIO(b"duplicate key"))

        monkeypatch.setattr(db, "safe_urlopen", boom)
        with pytest.raises(db.RestError) as exc:
            db.rest("POST", "opportunities", body=[{}])
        assert exc.value.__cause__ is not None
        assert "409" in str(exc.value)

    def test_refuses_a_non_https_url(self, monkeypatch):
        monkeypatch.setattr(db, "URL", "ftp://example.com")
        monkeypatch.setattr(db, "KEY", "k")
        with pytest.raises(ValueError, match="refusing"):
            db.rest("GET", "x")


class TestDiscoveryKind:
    """Regression: new kinds (fellowship, grant, ...) were pushed to a Postgres
    enum that did not contain them, failing the nightly refresh."""

    @staticmethod
    def enum_values():
        import re

        from conftest import ROOT

        sql = (ROOT / "supabase" / "migrations" / "0001_init.sql").read_text(encoding="utf-8")
        block = re.search(r"create type opportunity_kind as enum \((.*?)\);", sql, re.S).group(1)
        return set(re.findall(r"'([a-z_]+)'", block))

    def test_every_kind_the_schema_allows_is_storable(self, schema):
        enum = self.enum_values()
        stored = {kind: db.discovery_kind(kind) for kind in schema["properties"]["kind"]["enum"]}
        rejected = {k: v for k, v in stored.items() if v not in enum}
        assert not rejected, f"the discovery enum would reject: {rejected}"

    def test_kinds_the_enum_knows_pass_through_unchanged(self):
        for kind in ("hackathon", "ml_competition", "grad_programme", "competition"):
            assert db.discovery_kind(kind) == kind

    def test_new_kinds_map_to_the_nearest_stored_kind(self):
        assert db.discovery_kind("fellowship") == "grad_programme"
        assert db.discovery_kind("startup_competition") == "competition"
        assert db.discovery_kind("grant") == "accelerator"

    def test_a_missing_kind_defaults_to_hackathon(self):
        assert db.discovery_kind(None) == "hackathon"
        assert db.discovery_kind("") == "hackathon"

    def test_clean_uses_the_mapping(self):
        row = db._clean({"id": "x", "name": "X", "kind": "fellowship", "status": "open", "dates": {}, "links": {}})
        assert row["kind"] == "grad_programme"
