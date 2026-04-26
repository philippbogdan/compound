/**
 * Thin client for tribeux-server.
 *
 * The Vite dev server proxies `/api` to http://localhost:8000, so all
 * requests stay same-origin from the browser's point of view.
 */

const BASE = '/api'

export async function startAnalysis(url, { useRealRender = false } = {}) {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, use_real_render: useRealRender }),
  })
  if (!res.ok) throw new Error(`POST /api/analyze failed: ${res.status}`)
  return res.json()
}

export async function getJob(jobId) {
  const res = await fetch(`${BASE}/jobs/${jobId}`)
  if (!res.ok) throw new Error(`GET /api/jobs/${jobId} failed: ${res.status}`)
  return res.json()
}

export async function ping() {
  try {
    const res = await fetch(`${BASE}/health`)
    return res.ok
  } catch {
    return false
  }
}
