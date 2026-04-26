"""FastAPI entrypoint."""
from __future__ import annotations

import asyncio
import json

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

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
    job = jobs.store.create(req.url)
    asyncio.create_task(
        pipeline.run_pipeline(job.id, req.url, use_real_render=req.use_real_render)
    )
    return AnalyzeResponse(job_id=job.id)


@app.get("/api/jobs/{job_id}", response_model=Job)
def get_job(job_id: str) -> Job:
    job = jobs.store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return job


@app.get("/api/jobs/{job_id}/events")
async def job_events(job_id: str, request: Request) -> StreamingResponse:
    """Server-Sent Events stream for a job.

    Each event is a typed SSE message:
      event: log         data: {t, stage, message}
      event: progress    data: {stage, pct}
      event: checkpoint  data: {stage, kind, label, t, elapsed_ms}
      event: status      data: {status}
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
