/**
 * Frontend-only mock backend.
 *
 * Triggered by `?mock=1` on any route (or `localStorage.compound_mock=1`).
 * Returns an EventSource-shaped object that fires the same events the real
 * SSE stream emits, walking through every pipeline stage on a 2 s cadence.
 *
 * Lets you iterate on `/demo` and `/report` UI without standing up the
 * FastAPI server. Toggled exclusively at runtime — no env var needed.
 */
import { MOCK_REPORT, MOCK_STAGES } from './mockFixture'

const STAGE_DURATION_MS = 2000

let nextJobId = 1

/**
 * `?mock=1` in the current URL or `compound_mock=1` in localStorage. The
 * URL flag wins. We persist the URL flag to localStorage so the mock
 * state survives the React-Router route change after the verdict beat.
 */
export function isMockEnabled() {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.has('mock')) {
      const v = params.get('mock')
      const on = v === '' || v === '1' || v === 'true'
      if (on) {
        try { window.localStorage.setItem('compound_mock', '1') } catch { /* ignore */ }
      } else {
        try { window.localStorage.removeItem('compound_mock') } catch { /* ignore */ }
      }
      return on
    }
    return window.localStorage.getItem('compound_mock') === '1'
  } catch {
    return false
  }
}

/** A fake EventSource that the rest of the app can `.close()` like the real one. */
function makeFakeStream(jobId, url) {
  const listeners = {} // name → fn
  let closed = false
  let timers = []

  const fakeSource = {
    addEventListener(name, fn) {
      listeners[name] = fn
    },
    close() {
      closed = true
      timers.forEach(clearTimeout)
      timers = []
    },
    onerror: null,
    readyState: 1,
  }

  const fire = (name, payload) => {
    if (closed) return
    const handler = listeners[name]
    if (!handler) return
    handler({ data: payload != null ? JSON.stringify(payload) : '' })
  }

  // Walk each stage, fire begin checkpoint → log → progress → end
  // checkpoint, then advance. Matches the real backend's SSE shape.
  let acc = 0
  const fmtT = (ms) => {
    const mm = String(Math.floor(ms / 60000)).padStart(2, '0')
    const ss = String(Math.floor((ms / 1000) % 60)).padStart(2, '0')
    return `${mm}:${ss}`
  }
  MOCK_STAGES.forEach((stage, idx) => {
    const tStart = acc
    timers.push(setTimeout(() => {
      fire('checkpoint', {
        t: fmtT(tStart), stage: stage.key, kind: 'begin',
        label: stage.log.split('·')[0].trim(), elapsed_ms: 0,
      })
      fire('log', { t: fmtT(tStart), stage: stage.key.toUpperCase(), message: stage.log })
      fire('progress', { stage: stage.key, pct: ((idx + 1) / MOCK_STAGES.length) * 100 })
      if (idx === 0) fire('status', { status: 'running' })
    }, tStart))
    timers.push(setTimeout(() => {
      fire('checkpoint', {
        t: fmtT(tStart + STAGE_DURATION_MS - 1), stage: stage.key, kind: 'end',
        label: stage.log.split('·')[0].trim(), elapsed_ms: STAGE_DURATION_MS,
      })
    }, tStart + STAGE_DURATION_MS - 1))
    acc += STAGE_DURATION_MS
  })

  // Final result + done after the last stage.
  timers.push(setTimeout(() => {
    if (closed) return
    const result = { ...MOCK_REPORT, url: url || MOCK_REPORT.url }
    fire('result', result)
    fire('done', null)
    fakeSource.readyState = 2
  }, acc))

  return fakeSource
}

// Per-job state. `started` flips true when the first subscribe walks the
// pipeline; subsequent subscribes (e.g. Report re-hydrating from the URL
// after Demo navigates over) get the cached terminal events fired
// immediately so the pipeline doesn't restart from t=0.
const jobs = new Map()

function newJob(url) {
  const id = `mock-${String(nextJobId++).padStart(4, '0')}`
  jobs.set(id, { url, started: false, terminalEvents: null })
  return id
}

export async function startMockAnalysis(url) {
  return { job_id: newJob(url) }
}

function fmtT(ms) {
  const mm = String(Math.floor(ms / 60000)).padStart(2, '0')
  const ss = String(Math.floor((ms / 1000) % 60)).padStart(2, '0')
  return `${mm}:${ss}`
}

function buildTerminalEvents(url) {
  const result = { ...MOCK_REPORT, url: url || MOCK_REPORT.url }
  const out = []
  MOCK_STAGES.forEach((stage, idx) => {
    const tStart = idx * STAGE_DURATION_MS
    const label = stage.log.split('·')[0].trim()
    out.push(['checkpoint', { t: fmtT(tStart), stage: stage.key, kind: 'begin', label, elapsed_ms: 0 }])
    out.push(['log', { t: fmtT(tStart), stage: stage.key.toUpperCase(), message: stage.log }])
    out.push(['progress', { stage: stage.key, pct: ((idx + 1) / MOCK_STAGES.length) * 100 }])
    out.push(['checkpoint', { t: fmtT(tStart + STAGE_DURATION_MS - 1), stage: stage.key, kind: 'end', label, elapsed_ms: STAGE_DURATION_MS }])
  })
  out.push(['status', { status: 'done' }])
  out.push(['result', result])
  out.push(['done', null])
  return out
}

export function subscribeMockJob(jobId, handlers = {}) {
  let ctx = jobs.get(jobId)
  if (!ctx) {
    // Deep-linked into a job we never seeded (e.g. the user pasted a
    // /report?job=… URL fresh). Fabricate a context so the page still
    // renders. URL is unknown so use the fixture default.
    ctx = { url: 'https://example.com', started: false, terminalEvents: null }
    jobs.set(jobId, ctx)
  }

  const wrap = (fn) => (e) => {
    let payload
    try { payload = e.data ? JSON.parse(e.data) : null } catch { payload = e.data }
    fn(payload, e)
  }

  // Already finished (or being re-subscribed from Report after Demo)?
  // Replay the terminal events synchronously instead of walking again.
  if (ctx.started) {
    const events = ctx.terminalEvents || buildTerminalEvents(ctx.url)
    ctx.terminalEvents = events
    let closed = false
    const fakeSource = {
      addEventListener() { /* no-op; events fire from queueMicrotask below */ },
      close() { closed = true },
      onerror: null,
      readyState: 1,
    }
    // Defer with setTimeout (not queueMicrotask) so we land AFTER any
    // setState resets the consumer (e.g. useJob's effect resets state
    // via setTimeout(0) on subscribe — replaying before that would get
    // clobbered).
    setTimeout(() => {
      if (closed) return
      for (const [name, payload] of events) {
        const fn = handlers[name]
        if (!fn) continue
        wrap(fn)({ data: payload != null ? JSON.stringify(payload) : '' })
      }
      fakeSource.readyState = 2
    }, 16)
    return fakeSource
  }

  ctx.started = true
  const stream = makeFakeStream(jobId, ctx.url)
  for (const [name, fn] of Object.entries(handlers)) {
    stream.addEventListener(name, wrap(fn))
  }
  // After the stream completes, lock in terminal events for replays.
  ctx.terminalEvents = buildTerminalEvents(ctx.url)
  return stream
}

export async function getMockJob(jobId) {
  const ctx = jobs.get(jobId) || { url: 'https://example.com' }
  return {
    id: jobId,
    url: ctx.url,
    status: 'done',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    progress: { stage: 'done', pct: 100 },
    logs: [],
    checkpoints: MOCK_STAGES.map((s) => ({ stage: s.key, ok: true })),
    result: { ...MOCK_REPORT, url: ctx.url },
    error: null,
  }
}

export const MOCK_STAGE_DURATION_MS = STAGE_DURATION_MS
