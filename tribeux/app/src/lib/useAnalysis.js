import { useEffect, useRef, useState } from 'react'
import { startAnalysis, subscribeJob } from './api'

/**
 * Build a `Job`-shaped object incrementally from an SSE stream.
 *
 * Returns a stable `[job, setJob, applyEvent]` tuple. `applyEvent` takes
 * an `(eventName, payload)` pair and folds it into the job state — the
 * resulting shape mirrors `tribeux_server.schemas.Job` so the rest of
 * the frontend (Demo, Report) stays untouched.
 */
function makeApply(setJob, jobId) {
  return (name, payload) => {
    setJob((prev) => {
      const base = prev || {
        id: jobId,
        url: '',
        status: 'queued',
        created_at: '',
        updated_at: '',
        progress: { stage: 'queued', pct: 0 },
        logs: [],
        checkpoints: [],
        result: null,
        error: null,
      }
      switch (name) {
        case 'log':
          return { ...base, logs: [...base.logs, payload] }
        case 'checkpoint':
          return { ...base, checkpoints: [...base.checkpoints, payload] }
        case 'progress':
          return { ...base, progress: payload }
        case 'status':
          return { ...base, status: payload.status }
        case 'result':
          return { ...base, result: payload, status: 'done' }
        case 'error':
          return { ...base, error: payload?.message || 'pipeline error', status: 'error' }
        case 'done':
          return base
        default:
          return base
      }
    })
  }
}

/**
 * Subscribe to an existing job by id over SSE. Used by Report to
 * rehydrate after a deep-link reload.
 */
export function useJob(jobId) {
  const [job, setJob] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!jobId) return undefined
    let cancelled = false
    // Defer state resets until after mount so we don't synchronously
    // setState inside the effect body (lint: react-hooks/set-state-in-effect).
    const resetId = setTimeout(() => {
      if (cancelled) return
      setJob(null)
      setError(null)
    }, 0)
    const apply = makeApply(setJob, jobId)
    const handlers = {
      log: (p) => apply('log', p),
      checkpoint: (p) => apply('checkpoint', p),
      progress: (p) => apply('progress', p),
      status: (p) => apply('status', p),
      result: (p) => apply('result', p),
      error: (p) => {
        apply('error', p)
        setError(p?.message || 'pipeline error')
      },
      done: () => {},
    }
    const es = subscribeJob(jobId, handlers)
    es.onerror = () => {
      // EventSource auto-reconnects; surface a soft error only if we
      // can't open the stream at all.
      if (es.readyState === EventSource.CLOSED) setError('stream closed')
    }
    return () => {
      cancelled = true
      clearTimeout(resetId)
      es.close()
    }
  }, [jobId])

  return { job, error }
}

/**
 * Run the full neural-UX pipeline against `url` and stream status
 * over SSE. `auto: true` (default) starts a new analysis on mount.
 */
export function useAnalysis(url, { auto = true } = {}) {
  const [job, setJob] = useState(null)
  const [error, setError] = useState(null)
  const esRef = useRef(null)

  const start = async (override) => {
    const target = override || url
    if (!target) return
    setError(null)
    setJob(null)
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    try {
      const { job_id } = await startAnalysis(target)
      const apply = makeApply(setJob, job_id)
      const handlers = {
        log: (p) => apply('log', p),
        checkpoint: (p) => apply('checkpoint', p),
        progress: (p) => apply('progress', p),
        status: (p) => apply('status', p),
        result: (p) => apply('result', p),
        error: (p) => {
          apply('error', p)
          setError(p?.message || 'pipeline error')
        },
        done: () => {
          if (esRef.current) {
            esRef.current.close()
            esRef.current = null
          }
        },
      }
      esRef.current = subscribeJob(job_id, handlers)
      esRef.current.onerror = () => {
        if (esRef.current?.readyState === EventSource.CLOSED) {
          setError('stream closed')
        }
      }
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => {
    if (!auto) return undefined
    const id = setTimeout(() => start(url), 0)
    return () => {
      clearTimeout(id)
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, auto])

  return { job, error, start }
}
