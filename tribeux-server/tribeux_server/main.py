"""FastAPI entrypoint."""
from __future__ import annotations

import asyncio

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

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
