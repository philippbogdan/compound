import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import BrainCanvas from './BrainCanvas'
import { EASE_OUT_QUINT, PAGE_VARIANTS, PAGE_TRANSITION } from './motion'
import { useAnalysis } from './lib/useAnalysis'

// Stages are derived from the server's `progress.stage` and our static
// labelling map. The list mirrors the orchestrator in tribeux-server.
const STAGES = [
  { key: 'queued',    label: 'QUEUED',     long: 'Waiting for a worker' },
  { key: 'render',    label: 'RENDER',     long: 'Playwright + tribedomtree' },
  { key: 'encode',    label: 'ENCODE',     long: '13 × 256² scrolling capture' },
  { key: 'tribe',     label: 'TRIBE v2',   long: 'Cortical response, frame by frame' },
  { key: 'project',   label: 'PROJECT',    long: 'Destrieux to affective axes' },
  { key: 'benchmark', label: 'BENCHMARK',  long: 'Z-score vs n=30 corpus' },
  { key: 'claude',    label: 'CLAUDE',     long: 'Anomaly review + redesign proposals' },
  { key: 'frames',    label: 'FRAMES',     long: 'Pull frames Claude flagged' },
  { key: 'compose',   label: 'COMPOSE',    long: 'Apply patches via tribedomtree' },
  { key: 'done',      label: 'VERDICT',    long: 'Predicted uplift' },
]
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]))

const QUIET_STAGES = new Set(['claude', 'compose', 'done'])

const VERDICT_BEAT_MS = 1200

export default function Demo() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const urlFromQuery = params.get('url') || 'stripe.com'
  const { job, error } = useAnalysis(urlFromQuery)

  const status = job?.status || 'queued'
  const isComplete = status === 'done'
  const stageKey = isComplete ? 'done' : (job?.progress?.stage || 'queued')
  const activeIdx = STAGE_INDEX[stageKey] ?? 0
  const sparklineQuiet = QUIET_STAGES.has(stageKey)

  // Pick the most relevant stimulus frame for the active stage.
  const frames = useMemo(() => job?.result?.frames || [], [job?.result?.frames])
  const flaggedIndices = job?.result?.findings?.asked_for_frame_indices || []
  const stimulusFrame = useMemo(() => {
    if (!frames.length) return null
    const t = Math.min(frames.length - 1, Math.max(0, activeIdx))
    return frames[t]
  }, [frames, activeIdx])

  const [bars, setBars] = useState(() => Array(24).fill(0.3))
  const tRef = useRef(0)
  useEffect(() => {
    if (sparklineQuiet || isComplete) return undefined
    const t = setInterval(() => {
      setBars(prev => {
        const next = prev.slice(1)
        tRef.current += 0.18
        const y = 0.45 + Math.sin(tRef.current) * 0.27
                       + Math.sin(tRef.current * 2.3) * 0.09
                       + (Math.random() - 0.5) * 0.12
        next.push(Math.max(0.08, Math.min(1, y)))
        return next
      })
    }, sparklineQuiet ? 320 : 200)
    return () => clearInterval(t)
  }, [sparklineQuiet, isComplete])

  // Route to the report a beat after the verdict frame appears so the
  // motion has time to settle.
  useEffect(() => {
    if (!isComplete) return undefined
    const id = setTimeout(() => nav(`/report?job=${job.id}`), VERDICT_BEAT_MS)
    return () => clearTimeout(id)
  }, [isComplete, job?.id, nav])

  const visibleLogs = job?.logs || []
  const verdictZ = useMemo(() => {
    if (!job?.result) return null
    const cohort = job.result.v1.video_modality.headline_scores_vs_cohort
    // Pick the worst axis, signed (disgust > 0 is bad, others < 0 is bad).
    const candidates = [
      ['attention', -cohort.attention.cohort_z],
      ['self_relevance', -cohort.self_relevance.cohort_z],
      ['reward', -cohort.reward.cohort_z],
      ['disgust', cohort.disgust.cohort_z],
    ]
    candidates.sort((a, b) => b[1] - a[1])
    const [axis, mag] = candidates[0]
    const signedZ = axis === 'disgust' ? cohort.disgust.cohort_z : -mag
    return { axis, z: signedZ }
  }, [job?.result])

  return (
    <motion.section
      className="scan"
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={PAGE_TRANSITION}
    >
      <aside className="scan__chrono" aria-label="Pipeline stages">
        <h4>Pipeline</h4>
        {STAGES.slice(1).map((s, idx) => {
          const i = idx + 1
          const done = i < activeIdx
          const active = i === activeIdx
          return (
            <div
              key={s.key}
              className={
                'stage-row ' +
                (done ? 'is-done ' : '') +
                (active ? 'is-active ' : '')
              }
              style={{ '--stage-ms': '1400ms' }}
            >
              <span className="stage-row__num">{String(i).padStart(2, '0')}</span>
              <span>{s.label}</span>
              <span className="stage-row__dur">·</span>
            </div>
          )
        })}
      </aside>

      <div className="scan__main">
        <h2 className="scan__headline">
          Reading the <span className="flame">homepage</span><br />
          one cortical frame at a time.
        </h2>

        <div className="scan__target">
          <span className="scan__target__label">Target</span>
          <span className="scan__target__value">{urlFromQuery}</span>
          <span className="scan__target__label">
            {isComplete ? 'Verdict' : `Step ${activeIdx}/${STAGES.length - 1}`}
          </span>
        </div>

        <div className="scan__video">
          <div className="scan__video-frame" aria-label="256 by 256 stimulus preview">
            <AnimatePresence>
              {stimulusFrame && (
                <motion.img
                  key={`stimulus-${stimulusFrame.t}`}
                  src={stimulusFrame.data_url}
                  alt={`stimulus frame at t=${stimulusFrame.t}s`}
                  className="scan__video-media"
                  initial={{ opacity: 0, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.34, ease: EASE_OUT_QUINT }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </AnimatePresence>
            <span className="scan__video-frame__sweep" aria-hidden="true" />
            <span className="scan__video-frame__stamp">256 × 256</span>
            <span className="scan__video-frame__time">
              t = {stimulusFrame ? stimulusFrame.seconds.toFixed(1) : '0.0'}s
            </span>

            <AnimatePresence>
              {isComplete && verdictZ && (
                <motion.div
                  key="verdict-overlay"
                  className="scan__verdict-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: EASE_OUT_QUINT }}
                >
                  <motion.span
                    className="scan__verdict-overlay__tape"
                    initial={{ opacity: 0, y: -10, rotate: -6 }}
                    animate={{ opacity: 1, y: 0, rotate: -2 }}
                    transition={{ duration: 0.36, ease: EASE_OUT_QUINT, delay: 0.05 }}
                  >
                    FIG. 02 — VERDICT · {verdictZ.axis.toUpperCase()}
                  </motion.span>
                  <motion.span
                    className="scan__verdict-overlay__num"
                    initial={{ opacity: 0, scale: 0.7, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.5, ease: EASE_OUT_QUINT, delay: 0.12 }}
                  >
                    {verdictZ.z >= 0 ? '+' : '−'}
                    {Math.abs(verdictZ.z).toFixed(2)}σ
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <dl className="scan__meta">
            <dt>Now running</dt>
            <dd>
              {isComplete ? (
                <><span className="flame">VERDICT</span> · routing to report</>
              ) : (
                <>
                  <span className="flame">{(STAGES[activeIdx] || STAGES[0]).label}</span>
                  {' · '}
                  {(STAGES[activeIdx] || STAGES[0]).long}
                </>
              )}
            </dd>
            <dt>Stimulus</dt>
            <dd>{frames.length || 13} × 256² · scrolling capture</dd>
            <dt>Cortex model</dt>
            <dd>TRIBE v2 (stub) · Destrieux · 4 affective axes</dd>
          </dl>
        </div>

        <div className="scan__log" role="log" aria-live="polite">
          {visibleLogs.map((line, i) => (
            <div className="log-line" key={i} style={{ animationDelay: `${i * 40}ms` }}>
              <span>{line.t}</span>
              <span>{line.stage}</span>
              <span>{line.message}</span>
            </div>
          ))}
          {error && (
            <div className="log-line" style={{ color: 'var(--pulse)' }}>
              <span>ERR</span><span>client</span><span>{error}</span>
            </div>
          )}
        </div>
      </div>

      <aside className="scan__aside">
        <div className={'scan__aside__section' + (isComplete ? ' is-fading' : '')}>
          <h5>Live cortex · fsaverage5</h5>
          <div className="scan__brain">
            <BrainCanvas width={268} height={268} autoRotate brightness={1.05} />
          </div>
          <p className="scan__brain__caption">
            <strong>TRIBE v2 (stub) · plug-and-play</strong>
            <span>
              {flaggedIndices.length
                ? `Claude flagged frames ${flaggedIndices.join(', ')}`
                : 'awaiting Claude review'}
            </span>
          </p>
        </div>

        <div className="scan__aside__section">
          <h5>Benchmark · live</h5>
          <div className="benchmark-sparkline" aria-hidden="true">
            {bars.map((h, i) => (
              <div key={i} style={{ '--h': h.toFixed(3) }} />
            ))}
          </div>
          <p style={{
            marginTop: 12,
            fontSize: 12,
            fontFamily: 'var(--mono)',
            fontWeight: 700,
            color: 'var(--ink-mute)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
            {verdictZ
              ? `Z = ${verdictZ.z >= 0 ? '+' : '−'}${Math.abs(verdictZ.z).toFixed(2)} · ${verdictZ.axis} axis`
              : 'cohort n=30 · awaiting score'}
          </p>
        </div>

        <div className="scan__aside__section">
          <h5>License</h5>
          <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink-mute)' }}>
            TRIBE v2 is research-licensed (CC BY-NC). Non-clinical. Outputs are
            interpretive, not diagnostic.
          </p>
        </div>
      </aside>
    </motion.section>
  )
}
