"""Shared fixtures. The scripts are plain modules in scripts/ (pyproject puts
that directory on sys.path), so tests import them by name."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
DATA = ROOT / "data"

if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def root() -> Path:
    return ROOT


@pytest.fixture(scope="session")
def hackathons() -> dict:
    return read_json(DATA / "hackathons.json")


@pytest.fixture(scope="session")
def calendar_events() -> dict:
    return read_json(DATA / "calendar_events.json")


@pytest.fixture(scope="session")
def schema() -> dict:
    return read_json(ROOT / "schema" / "hackathon.schema.json")
