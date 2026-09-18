import json
import pathlib

import pytest

from mined_core import run

from .fixtures import make_daily

jsonschema = pytest.importorskip("jsonschema")
SCHEMA = json.loads((pathlib.Path(__file__).resolve().parents[2] / "schema/mined.week.v7.schema.json").read_text(encoding="utf-8"))


def test_every_week_matches_v7_schema():
    rows, meta = make_daily(years=3, events=[("2022-03-07", 7, "hard")], gap=("photo", "2021-06-01", "2021-09-30"))
    res = run(rows, meta)
    v = jsonschema.Draft202012Validator(SCHEMA)
    errors = [(w["week"], e.message) for w in res["weeks"] for e in v.iter_errors(w)]
    assert errors == []
