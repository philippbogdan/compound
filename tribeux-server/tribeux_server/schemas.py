"""Shared Pydantic schemas.

The `InferenceResult` block matches the output the TRIBE inference stage
emits exactly (the schema the user provided in samples/site_1.json). The
`Report` is the wider envelope the API hands back to the frontend; it
wraps a v1 + v2 inference result, the Claude findings, the captured
frames and the patched-screenshot pair.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Inference (matches the user's `example_data_fromtribeinference.json` shape)
# ---------------------------------------------------------------------------


Axis = Literal["attention", "self_relevance", "reward", "disgust"]


class HeadlineWithin(BaseModel):
    attention: float
    self_relevance: float
    reward: float
    disgust: float
    overall: float


class CohortScore(BaseModel):
    raw_score: float
    cohort_z: float
    percentile: float


class HeadlineVsCohort(BaseModel):
    attention: CohortScore
    self_relevance: CohortScore
    reward: CohortScore
    disgust: CohortScore


class TimeSeries(BaseModel):
    attention: list[float]
    self_relevance: list[float]
    reward: list[float]
    disgust: list[float]


class VideoModality(BaseModel):
    headline_scores_within_site: HeadlineWithin
    headline_scores_vs_cohort: HeadlineVsCohort
    time_series_zscored: TimeSeries
    time_series_absolute: TimeSeries


class InferenceMetadata(BaseModel):
    url_or_description: str
    tribe_timesteps: int
    scored_at_utc: str
    pipeline_version: str
    modalities_scored: list[str]


class InferenceResult(BaseModel):
    site_id: str
    label: str
    metadata: InferenceMetadata
    video_modality: VideoModality


# ---------------------------------------------------------------------------
# Cohort
# ---------------------------------------------------------------------------


class AxisStat(BaseModel):
    mean: float
    std: float


class Cohort(BaseModel):
    cohort_id: str
    n: int
    sites: list[str]
    axes: list[str]
    axis_stats: dict[str, AxisStat]
    interpretation: dict[str, str]
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Frames captured from the rendered page
# ---------------------------------------------------------------------------


class Frame(BaseModel):
    """A single frame extracted from the scrolling render.

    `t` is the timestep (0-indexed) and lines up with the inference
    `time_series_*` arrays. `data_url` is a base64-encoded PNG so the
    frontend can render it without a second request.
    """

    t: int
    seconds: float
    data_url: str
    width: int
    height: int


# ---------------------------------------------------------------------------
# Claude analyst output
# ---------------------------------------------------------------------------


class Anomaly(BaseModel):
    axis: Axis
    t_start: int
    t_end: int
    severity: float = Field(..., description="|cohort_z| at the worst point in the window.")
    headline: str
    rationale: str
    frame_indices: list[int]


class PatchProposal(BaseModel):
    unit_id: str
    selector: str
    section: Optional[str] = None
    before_html: str
    after_html: str
    rationale: str
    target_axis: Axis
    expected_delta_z: float = Field(
        ..., description="Predicted change in cohort_z on `target_axis` (positive = better)."
    )


class ClaudeFindings(BaseModel):
    summary: str
    anomalies: list[Anomaly]
    patches: list[PatchProposal]
    asked_for_frame_indices: list[int]
    model: str
    mock: bool


# ---------------------------------------------------------------------------
# Final report payload returned by /api/jobs/{id}
# ---------------------------------------------------------------------------


class AppliedPatch(BaseModel):
    proposal: PatchProposal
    applied: bool
    error: Optional[str] = None


class Report(BaseModel):
    url: str
    v1: InferenceResult
    v2: Optional[InferenceResult]
    cohort: Cohort
    frames: list[Frame]
    findings: ClaudeFindings
    applied_patches: list[AppliedPatch]
    screenshot_v1_data_url: Optional[str] = None
    screenshot_v2_data_url: Optional[str] = None
    # Inline mp4 (data: URL) of the recorded scrolls. v2 only present
    # when at least one Claude patch landed and the patched page was
    # successfully re-rendered.
    video_v1_data_url: Optional[str] = None
    video_v2_data_url: Optional[str] = None
    predicted_uplift_per_axis: dict[str, float]
    overall_predicted_uplift: float


# ---------------------------------------------------------------------------
# Job lifecycle
# ---------------------------------------------------------------------------


JobStatus = Literal["queued", "running", "done", "error"]


class LogEntry(BaseModel):
    t: str  # mm:ss relative to job start
    stage: str
    message: str


class JobProgress(BaseModel):
    stage: str
    pct: float


class Checkpoint(BaseModel):
    """Stage transition marker emitted by the orchestrator.

    Pairs come in `begin`/`end` (or `fail`); `elapsed_ms` is measured
    from job start (begin) or from the begin event (end/fail).
    """

    stage: str
    kind: Literal["begin", "end", "fail"]
    label: str
    t: str  # mm:ss relative to job start
    elapsed_ms: int


class Job(BaseModel):
    id: str
    url: str
    status: JobStatus
    created_at: str
    updated_at: str
    progress: JobProgress
    logs: list[LogEntry]
    checkpoints: list[Checkpoint] = []
    result: Optional[Report] = None
    error: Optional[str] = None


class AnalyzeRequest(BaseModel):
    url: str
    use_real_render: bool = True  # Default on — frontend never passes the flag, demo wants real renders


class AnalyzeResponse(BaseModel):
    job_id: str
