from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel

from .models import Collection, Environment, RunReport, Scenario, TestCase

T = TypeVar("T", bound=BaseModel)


class Store:
    def __init__(self, path: str = "data/platform.sqlite3") -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS objects (
                    kind TEXT NOT NULL,
                    id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    PRIMARY KEY (kind, id)
                )
                """
            )

    def save(self, kind: str, obj: BaseModel) -> None:
        payload = obj.model_dump_json()
        with self._connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO objects(kind, id, payload) VALUES (?, ?, ?)",
                (kind, getattr(obj, "id"), payload),
            )

    def get_raw(self, kind: str, object_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT payload FROM objects WHERE kind = ? AND id = ?",
                (kind, object_id),
            ).fetchone()
        return json.loads(row["payload"]) if row else None

    def list_raw(self, kind: str) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute("SELECT payload FROM objects WHERE kind = ? ORDER BY id", (kind,)).fetchall()
        return [json.loads(row["payload"]) for row in rows]

    def delete(self, kind: str, object_id: str) -> bool:
        with self._connect() as conn:
            cur = conn.execute("DELETE FROM objects WHERE kind = ? AND id = ?", (kind, object_id))
        return cur.rowcount > 0

    def get_environment(self, object_id: str) -> Environment | None:
        raw = self.get_raw("environment", object_id)
        return Environment.model_validate(raw) if raw else None

    def list_environments(self) -> list[Environment]:
        return [Environment.model_validate(item) for item in self.list_raw("environment")]

    def get_case(self, object_id: str) -> TestCase | None:
        raw = self.get_raw("case", object_id)
        return TestCase.model_validate(raw) if raw else None

    def list_cases(self) -> list[TestCase]:
        return [TestCase.model_validate(item) for item in self.list_raw("case")]

    def get_scenario(self, object_id: str) -> Scenario | None:
        raw = self.get_raw("scenario", object_id)
        return Scenario.model_validate(raw) if raw else None

    def list_scenarios(self) -> list[Scenario]:
        return [Scenario.model_validate(item) for item in self.list_raw("scenario")]

    def get_collection(self, object_id: str) -> Collection | None:
        raw = self.get_raw("collection", object_id)
        return Collection.model_validate(raw) if raw else None

    def list_collections(self) -> list[Collection]:
        return [Collection.model_validate(item) for item in self.list_raw("collection")]

    def get_report(self, object_id: str) -> RunReport | None:
        raw = self.get_raw("report", object_id)
        return RunReport.model_validate(raw) if raw else None

    def list_reports(self) -> list[RunReport]:
        return [RunReport.model_validate(item) for item in self.list_raw("report")]

