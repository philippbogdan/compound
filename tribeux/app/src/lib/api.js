/**
 * Thin client for tribeux-server.
 *
 * The Vite dev server proxies `/api` to http://localhost:8000, so all
 * requests stay same-origin from the browser's point of view.
 *
 * When `?mock=1` is set on the URL (persisted to localStorage so it
 * survives route changes), every call here delegates to a frontend-only
 * mock implementation — see `mockApi.js`. This lets you audit and
 * iterate on the UI without standing up the FastAPI backend.
 */
import {
  isMockEnabled,
  startMockAnalysis,
  subscribeMockJob,
  getMockJob,
} from './mockApi'

const BASE = '/api'

export async function startAnalysis(url, { useRealRender = false } = {}) {
  if (isMockEnabled()) return startMockAnalysis(url)
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, use_real_render: useRealRender }),
  })
  if (!res.ok) throw new Error(`POST /api/analyze failed: ${res.status}`)
  return res.json()
}

export async function getJob(jobId) {
  if (isMockEnabled()) return getMockJob(jobId)
  const res = await fetch(`${BASE}/jobs/${jobId}`)
  if (!res.ok) throw new Error(`GET /api/jobs/${jobId} failed: ${res.status}`)
  return res.json()
}

/**
 * Subscribe to the SSE event stream for a job.
 *
 * `handlers` is a map of `{eventName: (payload) => void}`. Returns the
 * underlying EventSource so the caller can `.close()` it.
 *
 * Emitted event names match the server: `log`, `progress`, `checkpoint`,
 * `status`, `result`, `error`, `done`.
 */
export function subscribeJob(jobId, handlers = {}) {
  if (isMockEnabled()) return subscribeMockJob(jobId, handlers)
  const es = new EventSource(`${BASE}/jobs/${jobId}/events`)
  const wrap = (_name, fn) => (e) => {
    let payload
    try {
      payload = e.data ? JSON.parse(e.data) : null
    } catch {
      payload = e.data
    }
    fn(payload, e)
  }
  for (const [name, fn] of Object.entries(handlers)) {
    es.addEventListener(name, wrap(name, fn))
  }
  return es
}

export async function ping() {
  if (isMockEnabled()) return true
  try {
    const res = await fetch(`${BASE}/health`)
    return res.ok
  } catch {
    return false
  }
}
