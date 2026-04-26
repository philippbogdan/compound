# tribeux-server

FastAPI orchestrator for the TribeUX neural-UX pipeline. The server is the
single thing the frontend talks to — it owns the **render → frames → stub
TRIBE → Claude analyst → tribedomtree patching → v2 re-inference** loop.

```
URL ──► tribeux_domtree.analyze (DOM units, sections, screenshot)
    ──► frames.capture_frames    (13 × 256² screenshots, one per timestep)
    ──► inference.run_tribe      (STUB — returns samples/site_1.json shape)
    ──► claude_analyst.analyze   (anomalies + DOM patches; MOCK_CLAUDE=1 by default)
    ──► tribedomtree.patch.apply_patch  (apply each proposal in Playwright)
    ──► inference.run_v2_inference (STUB — shifts scores by Claude's predicted uplift)
    ──► Report  (v1, v2, anomalies, patches, frames, before/after, uplift)
```

## Run locally

```bash
cd tribeux-server
uv venv && source .venv/bin/activate
uv pip install -e . -e ../tribeux-domtree
playwright install chromium  # only needed if you set use_real_render=true

uvicorn tribeux_server.main:app --reload --port 8000
```

The frontend at `tribeux/app` proxies `/api` to `http://localhost:8000`,
so just `npm run dev` in `tribeux/app` and open the URL it prints.

## Modes

| Env var               | Default | Effect                                                                 |
|-----------------------|---------|------------------------------------------------------------------------|
| `MOCK_CLAUDE`         | `1`     | Use the deterministic mock analyst. Set `0` (and provide a key) to call Claude. |
| `ANTHROPIC_API_KEY`   | unset   | Required when `MOCK_CLAUDE=0`. Standard Anthropic SDK env var.         |
| `ANTHROPIC_MODEL`     | `claude-3-5-sonnet-latest` | Override the analyst model. |

The request body's `use_real_render` flag controls whether the server
actually navigates Playwright at all. When `false` (default), a sample
screenshot is reused so the pipeline runs offline / in CI.

## API

- `POST /api/analyze` — `{url, use_real_render?}` → `{job_id}`
- `GET  /api/jobs/{id}` — full `Job` (status, logs, progress, result `Report`)
- `GET  /api/health`

The `Report` type is defined in `tribeux_server/schemas.py` and is the
single source of truth for the frontend.

## Stub inference contract

`inference.run_tribe_inference(url, frames)` returns the JSON shape from
`samples/site_1.json` verbatim, with `metadata.url_or_description`,
`metadata.tribe_timesteps` and `metadata.scored_at_utc` filled in. To
plug a real model in, replace that one function — nothing else moves.
