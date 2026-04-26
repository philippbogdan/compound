"""FastAPI entrypoint."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load .env from `tribeux-server/.env` first, then the repo root, before
# any submodule reads os.environ.
_HERE = Path(__file__).resolve().parent.parent
for candidate in (_HERE / ".env", _HERE.parent / ".env"):
    if candidate.is_file():
        load_dotenv(candidate, override=False)

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from . import jobs, pipeline
from .schemas import AnalyzeRequest, AnalyzeResponse, Job

app = FastAPI(title="tribeux-server", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    # Normalize bare hostnames so Playwright doesn't reject "airbnb.com".
    url = _normalize_url(req.url)

    # Resolve the iteration index from the parent chain (if any).
    parent_id = req.parent_job_id
    iter_index = 0
    if parent_id:
        parent = jobs.store.get(parent_id)
        if parent is not None:
            iter_index = (parent.iteration_index or 0) + 1

    job = jobs.store.create(
        url,
        parent_job_id=parent_id,
        iteration_index=iter_index,
    )

    if req.iterations and req.iterations > 1:
        # Enqueue a chain: each child waits for its parent to finish.
        asyncio.create_task(
            _run_chain(
                job_id=job.id,
                url=url,
                use_real_render=req.use_real_render,
                parent_job_id=parent_id,
                iteration_index=iter_index,
                remaining=req.iterations - 1,
            )
        )
    else:
        asyncio.create_task(
            pipeline.run_pipeline(
                job.id,
                url,
                use_real_render=req.use_real_render,
                parent_job_id=parent_id,
                iteration_index=iter_index,
            )
        )
    return AnalyzeResponse(job_id=job.id)


def _normalize_url(raw: str) -> str:
    """Playwright refuses bare hostnames — `airbnb.com` fails. Prepend
    `https://` when the user omits the scheme. Strips stray whitespace."""
    u = (raw or "").strip()
    if not u:
        return u
    lower = u.lower()
    if lower.startswith(("http://", "https://")):
        return u
    # Tolerate accidental `//airbnb.com` or `www.airbnb.com`.
    if u.startswith("//"):
        return "https:" + u
    return "https://" + u


async def _run_chain(
    *,
    job_id: str,
    url: str,
    use_real_render: bool,
    parent_job_id: Optional[str],
    iteration_index: int,
    remaining: int,
) -> None:
    """Run the first iteration, then spawn `remaining` more, each chained
    off the previous. Stops early if a pass emits `done=true`.
    """
    await pipeline.run_pipeline(
        job_id,
        url,
        use_real_render=use_real_render,
        parent_job_id=parent_job_id,
        iteration_index=iteration_index,
    )

    prev_job = jobs.store.get(job_id)
    if (
        remaining <= 0
        or prev_job is None
        or prev_job.status != "done"
        or (prev_job.result is not None and prev_job.result.done)
    ):
        return

    next_job = jobs.store.create(
        url,
        parent_job_id=job_id,
        iteration_index=iteration_index + 1,
    )
    await _run_chain(
        job_id=next_job.id,
        url=url,
        use_real_render=use_real_render,
        parent_job_id=job_id,
        iteration_index=iteration_index + 1,
        remaining=remaining - 1,
    )


@app.get("/api/jobs/{job_id}", response_model=Job)
def get_job(job_id: str) -> Job:
    job = jobs.store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return job


@app.get("/api/jobs/{job_id}/chain")
def get_chain(job_id: str) -> dict:
    """Return the full iteration chain (root → this job) as compact summaries
    the UI can use to draw a breadcrumb."""
    tail = jobs.store.get(job_id)
    if not tail:
        raise HTTPException(status_code=404, detail="job not found")
    ordered: list = []
    seen: set[str] = set()
    cur = tail
    while cur and cur.id not in seen:
        seen.add(cur.id)
        ordered.append(cur)
        parent_id = getattr(cur, "parent_job_id", None)
        cur = jobs.store.get(parent_id) if parent_id else None
    ordered.reverse()

    summaries = []
    for j in ordered:
        r = j.result
        cohort = None
        if r is not None:
            c = r.v1.video_modality.headline_scores_vs_cohort
            cohort = {
                "attention": c.attention.cohort_z,
                "self_relevance": c.self_relevance.cohort_z,
                "reward": c.reward.cohort_z,
                "disgust": c.disgust.cohort_z,
            }
        summaries.append({
            "job_id": j.id,
            "iteration_index": j.iteration_index,
            "status": j.status,
            "url": j.url,
            "diagnosis": r.findings.summary if r else None,
            "cohort_z": cohort,
            "done": r.done if r else False,
        })
    return {"chain": summaries}


@app.get("/api/jobs/{job_id}/video")
def get_job_video(job_id: str) -> FileResponse:
    """Stream the scrolling-capture mp4 produced by the encode stage.

    The file lives in a per-job temp dir on the server; we resolve it
    via the job store so the on-disk path never has to be exposed.
    """
    job = jobs.store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    video_path = jobs.store.get_video_path(job_id)
    if not video_path or not Path(video_path).is_file():
        raise HTTPException(status_code=404, detail="video not ready")
    return FileResponse(
        video_path,
        media_type="video/mp4",
        headers={"Cache-Control": "no-cache"},
    )


@app.get("/api/jobs/{job_id}/events")
async def job_events(job_id: str, request: Request) -> StreamingResponse:
    """Server-Sent Events stream for a job.

    Each event is a typed SSE message:
      event: log         data: {t, stage, message}
      event: progress    data: {stage, pct}
      event: checkpoint  data: {stage, kind, label, t, elapsed_ms}
      event: status      data: {status}
      event: video       data: {video_url}
      event: result      data: <Report>
      event: error       data: {message}
      event: done        data: {}

    Late subscribers get the full transcript replayed on connect, then
    live updates as the pipeline emits them.
    """
    job = jobs.store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")

    async def event_stream():
        q = jobs.store.subscribe(job_id)
        try:
            yield "retry: 2000\n\n"
            while True:
                if await request.is_disconnected():
                    return
                try:
                    event_type, payload = await asyncio.wait_for(q.get(), timeout=10.0)
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    continue
                yield f"event: {event_type}\n"
                yield f"data: {json.dumps(payload, default=str)}\n\n"
                if event_type == "done":
                    return
        finally:
            jobs.store.unsubscribe(job_id, q)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
