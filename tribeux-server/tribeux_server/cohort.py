"""Cohort baseline loader."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from .schemas import Cohort

_SAMPLES = Path(__file__).resolve().parent.parent / "samples"


@lru_cache(maxsize=1)
def load_cohort() -> Cohort:
    with (_SAMPLES / "cohort.json").open() as f:
        return Cohort.model_validate(json.load(f))
