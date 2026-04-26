import { useEffect, useRef, useState } from 'react'
import { getJob, startAnalysis } from './api'

/**
 * Subscribe to an already-created job by id. Used on direct
 * navigation to /report?job=... (full page reload, deep link).
 */
export function useJob(jobId, { pollMs = 500 } = {}) {
  const [job, setJob] = useState(null)
  const [error, setError] = useState(null)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    if (!jobId) return undefined
    let timer
    const tick = async () => {
      try {
        const next = await getJob(jobId)
        if (cancelled.current) return
        setJob(next)
        if (next.status === 'done' || next.status === 'error') return
        timer = setTimeout(tick, pollMs)
      } catch (e) {
        if (!cancelled.current) setError(String(e))
      }
    }
    tick()
    return () => {
      cancelled.current = true
      if (timer) clearTimeout(timer)
    }
  }, [jobId, pollMs])

  return { job, error }
}

/**
 * Run the full neural-UX pipeline against `url` and stream status.
 *
 * Returns `{ job, error, start }`. `job` mirrors the FastAPI `Job`
 * schema — including `logs`, `progress`, `status`, and the `result`
 * Report once `status === 'done'`.
 */
export function useAnalysis(url, { auto = true, pollMs = 350 } = {}) {
  const [job, setJob] = useState(null)
  const [error, setError] = useState(null)
  const cancelled = useRef(false)

  const start = async (override) => {
    const target = override || url
    if (!target) return
    cancelled.current = false
    setError(null)
    setJob(null)
    try {
      const { job_id } = await startAnalysis(target)
      let next = await getJob(job_id)
      setJob(next)
      while (!cancelled.current && next.status !== 'done' && next.status !== 'error') {
        await new Promise(r => setTimeout(r, pollMs))
        if (cancelled.current) return
        next = await getJob(job_id)
        setJob(next)
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
      cancelled.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, auto])

  return { job, error, start }
}
