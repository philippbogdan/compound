"""In-memory job store with SSE-style subscribers.

Trivial dict-backed store; the demo runs single-process. Swap with
Redis/pub-sub if you ever scale beyond one worker.

Each `JobStore` mutation (log, progress, checkpoint, finish, fail) is
broadcast to live `asyncio.Queue` subscribers so the
`GET /api/jobs/{id}/events` SSE endpoint can stream events as the
pipeline emits them — no polling.
"""
from __future__ import annotations

import asyncio
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from .schemas import Checkpoint, Job, JobProgress, LogEntry


class JobStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._jobs: dict[str, Job] = {}
        self._starts: dict[str, datetime] = {}
        self._subscribers: dict[str, list[asyncio.Queue[tuple[str, Any]]]] = {}
        # Server-local mp4 paths produced by the encode stage. Kept out
        # of the Job schema so the on-disk path never leaks to clients —
        # the client only sees the streaming URL set on `Job.video_url`.
        self._video_paths: dict[str, str] = {}

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def create(
        self,
        url: str,
        *,
        parent_job_id: Optional[str] = None,
        iteration_index: int = 0,
    ) -> Job:
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
            checkpoints=[],
            parent_job_id=parent_job_id,
            iteration_index=iteration_index,
        )
        with self._lock:
            self._jobs[job_id] = job
            self._starts[job_id] = datetime.now(timezone.utc)
            self._subscribers[job_id] = []
        return job

    def get(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(job_id)

    def _stamp(self, job_id: str) -> str:
        start = self._starts.get(job_id) or datetime.now(timezone.utc)
        delta = (datetime.now(timezone.utc) - start).total_seconds()
        m, s = divmod(int(delta), 60)
        return f"{m:02d}:{s:02d}"

    def _elapsed_ms(self, job_id: str) -> int:
        start = self._starts.get(job_id)
        if not start:
            return 0
        return int((datetime.now(timezone.utc) - start).total_seconds() * 1000)

    # ------------------------------------------------------------------
    # Pub/sub
    # ------------------------------------------------------------------

    def subscribe(self, job_id: str) -> asyncio.Queue[tuple[str, Any]]:
        """Open an event queue for a job and replay its current state.

        Replay lets a late subscriber (e.g. a deep-link reload after the
        job finished) still receive the full transcript + final result
        on connect.
        """
        q: asyncio.Queue[tuple[str, Any]] = asyncio.Queue()
        with self._lock:
            self._subscribers.setdefault(job_id, []).append(q)
            job = self._jobs.get(job_id)
            checkpoints = list(job.checkpoints) if job else []
            logs = list(job.logs) if job else []
            progress = job.progress if job else None
            status = job.status if job else None
            result = job.result if job else None
            error = job.error if job else None
            video_url = job.video_url if job else None

        # Replay buffered state in chronological-ish order.
        for cp in checkpoints:
            q.put_nowait(("checkpoint", cp.model_dump()))
        for entry in logs:
            q.put_nowait(("log", entry.model_dump()))
        if progress is not None:
            q.put_nowait(("progress", progress.model_dump()))
        if status is not None:
            q.put_nowait(("status", {"status": status}))
        # Replay video URL ahead of result so reconnects (e.g. Report
        # deep-links) can render the scrolling capture immediately.
        if video_url:
            q.put_nowait(("video", {"video_url": video_url}))
        if status == "done" and result is not None:
            q.put_nowait(("result", result.model_dump()))
            q.put_nowait(("done", {}))
        elif status == "error":
            q.put_nowait(("error", {"message": error or ""}))
            q.put_nowait(("done", {}))
        return q

    def unsubscribe(self, job_id: str, q: asyncio.Queue[tuple[str, Any]]) -> None:
        with self._lock:
            subs = self._subscribers.get(job_id)
            if subs and q in subs:
                subs.remove(q)

    def _broadcast(self, job_id: str, event_type: str, payload: Any) -> None:
        with self._lock:
            subs = list(self._subscribers.get(job_id, []))
        for q in subs:
            try:
                q.put_nowait((event_type, payload))
            except asyncio.QueueFull:  # pragma: no cover — unbounded queue
                pass

    # ------------------------------------------------------------------
    # State mutations (each broadcasts an SSE event)
    # ------------------------------------------------------------------

    def log(self, job_id: str, stage: str, message: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            entry = LogEntry(t=self._stamp(job_id), stage=stage, message=message)
            job.logs.append(entry)
            job.updated_at = self._now()
        self._broadcast(job_id, "log", entry.model_dump())

    def progress(self, job_id: str, stage: str, pct: float) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.progress = JobProgress(stage=stage, pct=max(0.0, min(1.0, pct)))
            job.status = "running"
            job.updated_at = self._now()
            payload = job.progress.model_dump()
        self._broadcast(job_id, "progress", payload)
        self._broadcast(job_id, "status", {"status": "running"})

    def checkpoint(
        self,
        job_id: str,
        stage: str,
        kind: str,
        label: str,
        *,
        elapsed_ms: Optional[int] = None,
    ) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            cp = Checkpoint(
                stage=stage,
                kind=kind,
                label=label,
                t=self._stamp(job_id),
                elapsed_ms=elapsed_ms if elapsed_ms is not None else self._elapsed_ms(job_id),
            )
            job.checkpoints.append(cp)
            job.updated_at = self._now()
        self._broadcast(job_id, "checkpoint", cp.model_dump())

    def set_video(self, job_id: str, video_path: str) -> None:
        """Register the scrolling-capture mp4 for `job_id` and broadcast.

        The path stays server-side; subscribers receive a `video` SSE
        event carrying the public streaming URL so they can wire up
        `<video src=...>` while later pipeline stages keep running.
        """
        video_url = f"/api/jobs/{job_id}/video"
        with self._lock:
            self._video_paths[job_id] = video_path
            job = self._jobs.get(job_id)
            if job is not None:
                job.video_url = video_url
                job.updated_at = self._now()
        self._broadcast(job_id, "video", {"video_url": video_url})

    def get_video_path(self, job_id: str) -> Optional[str]:
        with self._lock:
            return self._video_paths.get(job_id)

    def finish(self, job_id: str, result) -> None:  # type: ignore[no-untyped-def]
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.status = "done"
            job.progress = JobProgress(stage="done", pct=1.0)
            job.result = result
            job.updated_at = self._now()
            payload = result.model_dump() if hasattr(result, "model_dump") else result
        self._broadcast(job_id, "progress", {"stage": "done", "pct": 1.0})
        self._broadcast(job_id, "status", {"status": "done"})
        self._broadcast(job_id, "result", payload)
        self._broadcast(job_id, "done", {})

    def fail(self, job_id: str, error: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.status = "error"
            job.error = error
            job.updated_at = self._now()
        self._broadcast(job_id, "status", {"status": "error"})
        self._broadcast(job_id, "error", {"message": error})
        self._broadcast(job_id, "done", {})


store = JobStore()


def schedule(coro) -> None:
    """Fire-and-forget a coroutine on the running event loop."""
    asyncio.get_event_loop().create_task(coro)


# Used by pipeline.run_pipeline to bracket each stage with begin/end
# checkpoints and an elapsed-ms measurement.
class _StageContext:
    def __init__(self, job_id: str, stage: str, label: str) -> None:
        self._job_id = job_id
        self._stage = stage
        self._label = label
        self._start = 0.0

    async def __aenter__(self) -> "_StageContext":
        self._start = time.perf_counter()
        store.checkpoint(self._job_id, self._stage, "begin", self._label, elapsed_ms=0)
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        elapsed_ms = int((time.perf_counter() - self._start) * 1000)
        kind = "fail" if exc_type else "end"
        store.checkpoint(self._job_id, self._stage, kind, self._label, elapsed_ms=elapsed_ms)


def stage(job_id: str, stage_name: str, label: str) -> _StageContext:
    return _StageContext(job_id, stage_name, label)
