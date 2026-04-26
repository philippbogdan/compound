import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import BrainCanvas from './BrainCanvas'
import { EASE_OUT_QUINT, PAGE_VARIANTS, PAGE_TRANSITION } from './motion'
import { useAnalysis, useJob } from './lib/useAnalysis'

// Stages are derived from the server's `progress.stage` and our static
// labelling map. The list mirrors the orchestrator in tribeux-server.
// `headline` morphs the page hero so the largest type on the page tracks
// what's actually happening right now.
const STAGES = [
  { key: 'queued',    label: 'QUEUED',     long: 'Waiting for a worker',
    headline: ['Queueing', 'the scan.'] },
  { key: 'render',    label: 'RENDER',     long: 'Playwright + tribedomtree',
    headline: ['Capturing the page,', 'one scroll at a time.'] },
  { key: 'encode',    label: 'ENCODE',     long: '13 × 256² scrolling capture',
    headline: ['Compressing 4.8s of pixels', 'into a tensor.'] },
  { key: 'tribe',     label: 'TRIBE v2',   long: 'Cortical response, frame by frame',
    headline: ['Predicting cortical response', 'across 115 regions.'] },
  { key: 'project',   label: 'PROJECT',    long: 'Destrieux to affective axes',
    headline: ['Projecting Destrieux onto', 'four affective axes.'] },
  { key: 'benchmark', label: 'BENCHMARK',  long: 'Z-score vs n=30 corpus',
    headline: ['Z-scoring against', 'thirty real homepages.'] },
  { key: 'claude',    label: 'CLAUDE',     long: 'Anomaly review + redesign proposals',
    headline: ['Claude is reading', 'the anomalies.'] },
  { key: 'frames',    label: 'FRAMES',     long: 'Pull frames Claude flagged',
    headline: ['Pulling the four frames', 'that mattered.'] },
  { key: 'compose',   label: 'COMPOSE',    long: 'Apply patches via tribedomtree',
    headline: ['Patching the DOM', 'with the proposed redesign.'] },
  { key: 'done',      label: 'VERDICT',    long: 'Predicted uplift',
    headline: ['Findings', 'are ready.'] },
]
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]))

const QUIET_STAGES = new Set(['claude', 'compose', 'done'])

const VERDICT_BEAT_MS = 2800

export default function Demo() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const urlFromQuery = params.get('url') || 'stripe.com'
  const existingJobId = params.get('job') || null
  // If we're handed a `job=<id>` (iteration continuation), subscribe to that
  // job's SSE stream; otherwise kick off a fresh analysis.
  const analysis = useAnalysis(urlFromQuery, { auto: !existingJobId })
  const existing = useJob(existingJobId)
  const job = existingJobId ? existing.job : analysis.job
  const error = existingJobId ? existing.error : analysis.error

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
  // The scrolling-capture mp4 streams from the backend as soon as the
  // encode stage completes, so the user watches the actual scraped page
  // playing back while later stages (tribe / claude / compose) finish.
  const videoUrl = job?.video_url || null

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
  // motion has time to settle. The user can also tap the verdict overlay
  // to advance immediately.
  useEffect(() => {
    if (!isComplete) return undefined
    const id = setTimeout(() => nav(`/report?job=${job.id}`), VERDICT_BEAT_MS)
    return () => clearTimeout(id)
  }, [isComplete, job?.id, nav])

  const goToReport = () => {
    if (job?.id) nav(`/report?job=${job.id}`)
  }

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
        <h2 className="scan__headline" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.span
              key={stageKey}
              className="scan__headline__stage"
              initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
              transition={{ duration: 0.34, ease: EASE_OUT_QUINT }}
            >
              <span className="scan__headline__line scan__headline__line--lead">
                {(STAGES[activeIdx] || STAGES[0]).headline[0]}
              </span>
              <span className="scan__headline__line scan__headline__line--tail">
                {(STAGES[activeIdx] || STAGES[0]).headline[1]}
              </span>
            </motion.span>
          </AnimatePresence>
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
            {videoUrl ? (
              <motion.video
                key={`scan-video-${videoUrl}`}
                src={videoUrl}
                className="scan__video-media"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                initial={{ opacity: 0, filter: 'blur(8px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.42, ease: EASE_OUT_QUINT }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
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
            )}
            <span className="scan__video-frame__sweep" aria-hidden="true" />
            <span className="scan__video-frame__stamp">256 × 256</span>
            <span className="scan__video-frame__time">
              t = {stimulusFrame ? stimulusFrame.seconds.toFixed(1) : '0.0'}s
            </span>

            <AnimatePresence>
              {isComplete && verdictZ && (
                <motion.button
                  type="button"
                  key="verdict-overlay"
                  className="scan__verdict-overlay"
                  onClick={goToReport}
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
                    FIG. 02 — VERDICT · {verdictZ.axis.toUpperCase().replace('_', ' ')}
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
                  <motion.span
                    className="scan__verdict-overlay__cta"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.32, ease: EASE_OUT_QUINT, delay: 0.6 }}
                  >
                    [ tap to enter report ]
                  </motion.span>
                </motion.button>
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

        <CliStream
          logs={visibleLogs}
          checkpoints={job?.checkpoints || []}
          status={status}
          error={error}
        />
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

      </aside>
    </motion.section>
  )
}

// ---------------------------------------------------------------------------
// CliStream — live SSE-driven console.
//
// Merges `logs` and `checkpoints` arrays from the streamed job state into a
// single chronological event list. Renders log lines and stage-checkpoint
// markers with distinct affordances, auto-scrolls to the bottom as new
// events arrive, and shows a blinking caret while the pipeline is running.
// ---------------------------------------------------------------------------

function fmtMs(ms) {
  if (ms < 1) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function CliStream({ logs, checkpoints, status, error }) {
  // Merge the two streams into a single ordered list. Both arrive in
  // the order the server emitted them, so we just round-robin by index
  // weighted by the SSE arrival sequence: in practice a stage `begin`
  // checkpoint always lands immediately before that stage's first log
  // line. We render as a flat sequence preserving the relative order
  // by using the stage index as a tie-breaker.
  const stream = useMemo(() => {
    const items = []
    let li = 0, ci = 0
    while (li < logs.length || ci < checkpoints.length) {
      const ln = logs[li]
      const cp = checkpoints[ci]
      // Decide who goes next: a checkpoint goes before the first log
      // line of its stage; otherwise interleave by stage transitions.
      if (cp && (!ln || (cp.kind === 'begin' && stagePos(cp.stage) <= stagePos(ln.stage)))) {
        items.push({ kind: 'checkpoint', data: cp })
        ci++
      } else if (cp && cp.kind !== 'begin' && (!ln || stagePos(cp.stage) < stagePos(ln.stage))) {
        items.push({ kind: 'checkpoint', data: cp })
        ci++
      } else if (ln) {
        items.push({ kind: 'log', data: ln })
        li++
      } else if (cp) {
        items.push({ kind: 'checkpoint', data: cp })
        ci++
      }
    }
    return items
  }, [logs, checkpoints])

  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [stream.length])

  const isRunning = status === 'running' || status === 'queued'

  return (
    <div className="scan__log" role="log" aria-live="polite" ref={ref}>
      <div className="log-line log-line--prompt">
        <span>--:--</span>
        <span>boot</span>
        <span>tribeux-server · POST /api/analyze · subscribed to SSE /api/jobs/&lt;id&gt;/events</span>
      </div>
      {stream.map((it, i) => {
        // Mark the LAST item with `is-newest` so CSS can highlight it
        // regardless of trailing siblings (caret, error). Using `:last-child`
        // alone fails when other elements render after the stream.
        const newest = i === stream.length - 1 ? ' is-newest' : ''
        if (it.kind === 'checkpoint') {
          const cp = it.data
          const cls =
            'log-line log-line--cp ' +
            (cp.kind === 'begin' ? 'is-begin' : cp.kind === 'fail' ? 'is-fail' : 'is-end') +
            newest
          const glyph = cp.kind === 'begin' ? '▸' : cp.kind === 'fail' ? '✗' : '✓'
          const elapsed = cp.kind !== 'begin' ? `· ${fmtMs(cp.elapsed_ms)}` : ''
          return (
            <div className={cls} key={`cp-${i}`} style={{ animationDelay: `${i * 16}ms` }}>
              <span>{cp.t}</span>
              <span>{glyph} {cp.stage}</span>
              <span>{cp.label} {elapsed}</span>
            </div>
          )
        }
        const line = it.data
        return (
          <div className={'log-line' + newest} key={`log-${i}`} style={{ animationDelay: `${i * 16}ms` }}>
            <span>{line.t}</span>
            <span>{line.stage}</span>
            <span>{line.message}</span>
          </div>
        )
      })}
      {isRunning && (
        // Caret is intentionally NOT a `.log-line` — keeping that class would
        // make this the `:last-child` (since `column-reverse` puts the last
        // DOM child at the top), stealing the slam-in highlight from the
        // newest actual log row.
        <div className="scan__log__caret">
          <span>--:--</span>
          <span>·</span>
          <span><span className="caret">▮</span></span>
        </div>
      )}
      {error && (
        <div className="log-line" style={{ color: 'var(--pulse)' }}>
          <span>ERR</span><span>client</span><span>{error}</span>
        </div>
      )}
    </div>
  )
}

function stagePos(stage) {
  return STAGE_INDEX[stage] ?? 99
}
