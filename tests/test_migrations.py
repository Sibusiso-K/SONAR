"""Migrations are applied by a workflow, in one transaction, to a live
database. A syntax error should fail here, in CI, and never there."""

from __future__ import annotations

import pytest
from conftest import ROOT

pglast = pytest.importorskip("pglast", reason="pip install -r requirements-dev.txt")

MIGRATIONS = sorted([*(ROOT / "supabase" / "migrations").glob("*.sql"), *(ROOT / "web" / "supabase" / "migrations").glob("*.sql")])
AUDIT = ROOT / "supabase" / "audit" / "rls_audit.sql"


@pytest.mark.parametrize("path", MIGRATIONS, ids=lambda p: f"{p.parent.parent.parent.name}/{p.name}")
def test_migration_is_valid_postgres(path):
    assert pglast.parse_sql(path.read_text(encoding="utf-8"))


def test_there_are_migrations_to_check():
    assert len(MIGRATIONS) >= 10


def test_the_rls_audit_only_reads():
    statements = pglast.parse_sql(AUDIT.read_text(encoding="utf-8"))
    kinds = {type(s.stmt).__name__ for s in statements}
    assert kinds == {"SelectStmt"}, f"the audit must be read-only, found {kinds}"


def test_the_board_tables_stay_locked_down_in_the_migrations():
    """The anon key is public. After the lockdown migration, no later
    migration may grant it write access to the board tables."""
    import re

    text = "\n".join(p.read_text(encoding="utf-8") for p in MIGRATIONS if p.parent.parent.parent.name == "web")
    lockdown = (ROOT / "web" / "supabase" / "migrations" / "20260812_lock_down_anon_writes.sql").read_text(encoding="utf-8")
    assert re.search(r"revoke\s+insert,\s*update,\s*delete\s+on\s+public\.opportunities", lockdown, re.I)
    later = [
        p.read_text(encoding="utf-8")
        for p in MIGRATIONS
        if p.parent.parent.parent.name == "web" and p.name > "20260812_lock_down_anon_writes.sql"
    ]
    for sql in later:
        assert not re.search(r"grant\s+[^;]*\b(insert|update|delete|all)\b[^;]*\bon\s+(public\.)?(opportunities|past_opportunities)\b[^;]*\bto\s+[^;]*\banon\b", sql, re.I)
    assert text  # the web migrations were found
