"""In-memory job store.

Trivial dict-backed store; the demo runs single-process. Swap with
Redis if you ever scale beyond one worker.
"""
from __future__ import annotations

import asyncio
import threading
import uuid
from datetime import datetime, timezone
from typing import Optional

from .schemas import Job, JobProgress, LogEntry


class JobStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._jobs: dict[str, Job] = {}
        self._starts: dict[str, datetime] = {}

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def create(self, url: str) -> Job:
        job_id = uuid.uuid4().hex[:12]
        now = self._now()
        job = Job(
            id=job_id,
            url=url,
            status="queued",
            created_at=now,
            updated_at=now,
            progress=JobProgress(stage="queued", pct=0.0),
            logs=[],
        )
        with self._lock:
            self._jobs[job_id] = job
            self._starts[job_id] = datetime.now(timezone.utc)
        return job

    def get(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(job_id)

    def _stamp(self, job_id: str) -> str:
        start = self._starts.get(job_id) or datetime.now(timezone.utc)
        delta = (datetime.now(timezone.utc) - start).total_seconds()
        m, s = divmod(int(delta), 60)
        return f"{m:02d}:{s:02d}"

    def log(self, job_id: str, stage: str, message: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.logs.append(LogEntry(t=self._stamp(job_id), stage=stage, message=message))
            job.updated_at = self._now()

    def progress(self, job_id: str, stage: str, pct: float) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.progress = JobProgress(stage=stage, pct=max(0.0, min(1.0, pct)))
            job.status = "running"
            job.updated_at = self._now()

    def finish(self, job_id: str, result) -> None:  # type: ignore[no-untyped-def]
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.status = "done"
            job.progress = JobProgress(stage="done", pct=1.0)
            job.result = result
            job.updated_at = self._now()

    def fail(self, job_id: str, error: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.status = "error"
            job.error = error
            job.updated_at = self._now()


store = JobStore()


def schedule(coro) -> None:
    """Fire-and-forget a coroutine on the running event loop."""
    asyncio.get_event_loop().create_task(coro)
