import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PAGE_VARIANTS, PAGE_TRANSITION } from './motion'
import { useJob } from './lib/useAnalysis'
import { getChain, startAnalysis } from './lib/api'

const AXIS_META = {
  attention:      { name: 'Attention',      meta: 'FRONTO-PARIETAL · D29' },
  self_relevance: { name: 'Self-relevance', meta: 'DMN · PRECUNEUS' },
  reward:         { name: 'Reward',         meta: 'VENTRAL STRIATUM · VTA' },
  disgust:        { name: 'Disgust',        meta: 'INSULA · ORBITO-FR.' },
}

const FRICTION_AXES = new Set(['disgust'])

// Visual ordering matches the original report layout.
const AXIS_ORDER = ['attention', 'self_relevance', 'reward', 'disgust']

/**
 * Resample a sparse z-scored time series to N points using linear
 * interpolation, then map onto the 0..100 / 0..60 SVG coordinate space
 * the existing styles expect.
 */
function curveFromSeries(series, { n = 60, amp = 18 } = {}) {
  if (!series || series.length === 0) return ''
  const last = series.length - 1
  const pts = []
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * last
    const lo = Math.floor(t)
    const hi = Math.min(last, lo + 1)
    const f = t - lo
    const y = series[lo] * (1 - f) + series[hi] * f
    pts.push([(i / (n - 1)) * 100, 50 - y * amp])
  }
  return pts.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ')
}

function flatBenchPath(n = 60) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 100
    const y = 50 + Math.sin(i * 0.18) * 0.6 // tiny baseline ripple
    pts.push([x, y])
  }
  return pts.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ')
}

function EmotionRow({ axis, cohort, series, idx, expectedDelta }) {
  const meta = AXIS_META[axis]
  const friction = FRICTION_AXES.has(axis)
  const z = cohort.cohort_z
  const sign = z >= 0 ? '+' : '−'
  const val = Math.abs(z).toFixed(2)
  const zClass = Math.abs(z) >= 1 ? 'is-high' : 'is-good'

  const benchPath = useMemo(() => flatBenchPath(60), [])
  const livePath = useMemo(() => curveFromSeries(series), [series])

  return (
    <div className="emotion-row">
      <div className="emotion-row__label">
        <strong>
          {meta.name}
          {friction ? <span className="alt">(disgust)</span> : null}
        </strong>
        <span>{meta.meta}</span>
        {expectedDelta != null && Math.abs(expectedDelta) > 0.001 && (
          <span style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>
            v2 Δz {expectedDelta > 0 ? '+' : '−'}{Math.abs(expectedDelta).toFixed(2)}
          </span>
        )}
      </div>
      <div className="emotion-row__graph">
        <span className="emotion-row__y-axis" aria-hidden="true">
          <em>+1σ</em>
          <em>0</em>
          <em>−1σ</em>
        </span>
        <svg viewBox="0 0 100 60" preserveAspectRatio="none">
          <line className="zero" x1="0" y1="50" x2="100" y2="50" />
          <path className="bench" d={benchPath} />
          <path
            className={'live ' + (friction ? 'is-friction' : '')}
            d={livePath}
            style={{ animationDelay: `${idx * 120}ms` }}
          />
        </svg>
      </div>
      <div className={'emotion-row__z ' + zClass}>
        {sign}{val}
      </div>
    </div>
  )
}

function StarburstBadge({ uplift }) {
  const pct = Math.round(uplift * 14) // ~14% per σ — same scale as original art
  const sign = pct >= 0 ? '+' : '−'
  return (
    <svg className="starburst" viewBox="0 0 140 140" aria-hidden="true">
      <polygon
        points="70,4 82,36 112,20 104,54 136,60 110,80 134,108 100,100 108,134 76,112 70,140 64,112 32,134 40,100 6,108 30,80 4,60 36,54 28,20 58,36"
        fill="oklch(0.87 0.17 95)"
        stroke="oklch(0.16 0.010 260)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <text x="70" y="64" textAnchor="middle"
        fontFamily="'Bricolage Grotesque', sans-serif"
        fontWeight="800" fontSize="22"
        fill="oklch(0.16 0.010 260)"
        style={{ letterSpacing: '-0.02em' }}>{sign}{Math.abs(pct)}%</text>
      <text x="70" y="80" textAnchor="middle"
        fontFamily="'Space Mono', monospace"
        fontWeight="700" fontSize="7.5"
        fill="oklch(0.16 0.010 260)"
        style={{ letterSpacing: '0.16em' }}>PREDICTED</text>
      <text x="70" y="92" textAnchor="middle"
        fontFamily="'Space Mono', monospace"
        fontWeight="700" fontSize="7.5"
        fill="oklch(0.16 0.010 260)"
        style={{ letterSpacing: '0.16em' }}>UPLIFT</text>
    </svg>
  )
}

/**
 * Vertical-handle before/after wipe.
 *
 * `beforeSrc` is rendered full-bleed underneath; `afterSrc` is layered
 * on top and clipped from the left edge to the handle position. Drag
 * the handle right → reveals more of `before` (handle at far right
 * fully hides `after`). Drag left → reveals more of `after`.
 *
 * Pointer events drive both mouse and touch; arrow keys move the
 * handle in 2% (or 10% with shift) increments for keyboard users.
 */
function BeforeAfterSlider({ beforeSrc, afterSrc, beforeLabel, afterLabel, beforeFallback, afterFallback, uplift }) {
  const containerRef = useRef(null)
  const [pos, setPos] = useState(50)
  const draggingRef = useRef(false)

  const updateFromClientX = (clientX) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return
    const next = ((clientX - rect.left) / rect.width) * 100
    setPos(Math.max(0, Math.min(100, next)))
  }

  const onPointerDown = (e) => {
    draggingRef.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    updateFromClientX(e.clientX)
  }
  const onPointerMove = (e) => {
    if (!draggingRef.current) return
    updateFromClientX(e.clientX)
  }
  const onPointerUp = (e) => {
    draggingRef.current = false
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }
  const onKeyDown = (e) => {
    const step = e.shiftKey ? 10 : 2
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault(); setPos(p => Math.max(0, p - step))
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault(); setPos(p => Math.min(100, p + step))
    } else if (e.key === 'Home') {
      e.preventDefault(); setPos(0)
    } else if (e.key === 'End') {
      e.preventDefault(); setPos(100)
    }
  }

  return (
    <div
      className="ba-slider"
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* before — sits underneath, always full width */}
      <div className="ba-slider__layer">
        {beforeSrc ? (
          <img src={beforeSrc} alt={beforeLabel} className="ba-slider__img" />
        ) : beforeFallback}
        <span className="ba-slider__stamp ba-slider__stamp--before">{beforeLabel}</span>
      </div>
      {/* after — clipped from the left to the handle position */}
      <div className="ba-slider__layer ba-slider__layer--after" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        {afterSrc ? (
          <img src={afterSrc} alt={afterLabel} className="ba-slider__img" />
        ) : afterFallback}
        <span className="ba-slider__stamp ba-slider__stamp--after">{afterLabel}</span>
      </div>
      <div
        className="ba-slider__handle"
        role="slider"
        aria-label="Before/after slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        tabIndex={0}
        onKeyDown={onKeyDown}
        style={{ left: `${pos}%` }}
      >
        <span className="ba-slider__handle__rule" aria-hidden="true" />
        <span className="ba-slider__handle__knob" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M9 6 L4 12 L9 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15 6 L20 12 L15 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      <StarburstBadge uplift={uplift} />
    </div>
  )
}

function Loading({ label }) {
  return (
    <motion.section
      className="report"
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={PAGE_TRANSITION}
    >
      <div className="report__header">
        <div>
          <div className="report__eyebrow"><span>{label}</span></div>
          <h1 className="report__title">Loading findings…</h1>
        </div>
      </div>
    </motion.section>
  )
}

export default function Report() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const jobId = params.get('job')
  const { job, error } = useJob(jobId)
  const [chain, setChain] = useState([])
  const [iterCount, setIterCount] = useState(1)
  const [kicking, setKicking] = useState(false)
  const [kickErr, setKickErr] = useState(null)

  useEffect(() => {
    if (!jobId) return undefined
    let cancelled = false
    getChain(jobId)
      .then(({ chain }) => { if (!cancelled) setChain(chain || []) })
      .catch(() => { if (!cancelled) setChain([]) })
    return () => { cancelled = true }
  }, [jobId, job?.status])

  if (!jobId) return <Loading label="NO JOB ID — START A SCAN" />
  if (error) return <Loading label={`ERROR · ${error}`} />
  if (!job || job.status !== 'done' || !job.result) return <Loading label={`PIPELINE · ${job?.status || 'queued'}`} />

  const { result } = job
  const v1 = result.v1.video_modality
  const cohort = v1.headline_scores_vs_cohort
  const series = v1.time_series_zscored
  const findings = result.findings
  const patches = result.applied_patches.map(ap => ap.proposal)
  const iterationIndex = result.iteration_index ?? 0
  const isDone = Boolean(result.done)

  // Worst axis (signed direction)
  const ranked = AXIS_ORDER.map((axis) => {
    const z = cohort[axis].cohort_z
    const badness = axis === 'disgust' ? z : -z
    return { axis, z, badness }
  }).sort((a, b) => b.badness - a.badness)
  const worst = ranked[0]
  const worstMeta = AXIS_META[worst.axis]

  const uplift = result.overall_predicted_uplift || 0

  // Match a frame to each anomaly so the reader can see what Claude saw
  const framesByT = Object.fromEntries(result.frames.map(f => [f.t, f]))

  const tape = `FINDINGS · ${result.url} · ${new Date(result.v1.metadata.scored_at_utc).toISOString().slice(0, 10)} · ITER ${String(iterationIndex).padStart(2, '0')}`

  async function runMore() {
    setKicking(true)
    setKickErr(null)
    try {
      const { job_id } = await startAnalysis(result.url, {
        parentJobId: jobId,
        iterations: Math.max(1, Math.min(8, iterCount)),
      })
      navigate(`/demo?url=${encodeURIComponent(result.url)}&job=${job_id}`)
    } catch (e) {
      setKickErr(String(e))
    } finally {
      setKicking(false)
    }
  }

  function downloadReport() {
    const replayParts = []
    for (const h of result.history || []) {
      for (const e of h.edits || []) {
        replayParts.push(
          `try { const el = document.querySelector(${JSON.stringify(e.selector)}); if (el) el.outerHTML = ${JSON.stringify(e.after_html)}; } catch (err) { console.warn('tribeux replay failed', err); }`,
        )
      }
    }
    for (const p of patches) {
      replayParts.push(
        `try { const el = document.querySelector(${JSON.stringify(p.selector)}); if (el) el.outerHTML = ${JSON.stringify(p.after_html)}; } catch (err) { console.warn('tribeux replay failed', err); }`,
      )
    }
    const blob = new Blob([
      JSON.stringify({
        url: result.url,
        iteration_index: iterationIndex,
        parent_job_id: result.parent_job_id,
        cohort_z: Object.fromEntries(
          AXIS_ORDER.map(a => [a, cohort[a].cohort_z]),
        ),
        findings: {
          summary: findings.summary,
          history_note: findings.history_note,
          done: findings.done,
        },
        current_patches: patches,
        history: result.history || [],
        replay_script: replayParts.join('\n'),
        full_report: result,
      }, null, 2),
    ], { type: 'application/json' })
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = `tribeux_${jobId}_iter${iterationIndex}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(href)
  }

  return (
    <motion.section
      className="report"
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={PAGE_TRANSITION}
    >
      <div className="report__header">
        <div>
          <div className="report__eyebrow">
            <span>{tape}</span>
            <strong>
              {findings.anomalies.length} ANOMALY · {patches.length} REDESIGN
              {isDone && ' · CONVERGED'}
            </strong>
          </div>
          <h1 className="report__title">
            {findings.summary.split('.').slice(0, 1).join('.') || 'Findings'}
            {findings.mock && (
              <span className="alt" style={{ color: 'var(--ink-mute)', marginLeft: 8, fontWeight: 400 }}>
                (mock claude)
              </span>
            )}
          </h1>
        </div>
        <div className="report__verdict">
          <div className="report__verdict__z">
            <span className="num">
              {worst.z >= 0 ? '+' : '−'}{Math.abs(worst.z).toFixed(2)}
            </span>
            <span className="unit">
              <em>Z-score</em>
              <em>{worst.axis.replace('_', ' ').toUpperCase()}</em>
              <em>{worstMeta.meta}</em>
            </span>
          </div>
          <p className="report__verdict__body">
            {findings.summary}
          </p>
        </div>
      </div>

      {chain.length > 1 && (
        <HistoryBreadcrumb chain={chain} activeId={jobId} onJump={(id) => navigate(`/report?job=${id}`)} />
      )}

      <div className="report__hero">
        <div className="col-head">
          <span>§ D</span>
          <h3>Before, after</h3>
          <span className="col-head__hint">drag the handle ↔ to compare</span>
        </div>
        <BeforeAfterSlider
          beforeSrc={result.screenshot_v1_data_url || '/airbnb-landing.png'}
          afterSrc={result.screenshot_v2_data_url || null}
          beforeLabel="v1 · current"
          afterLabel="v2 · proposed"
          afterFallback={
            <img
              src="/sticker-brain-fire.png"
              alt="Proposed redesign"
              style={{
                width: '72%', height: 'auto', position: 'absolute',
                right: -20, bottom: -20, transform: 'rotate(6deg)', opacity: 0.55,
                mixBlendMode: 'multiply',
              }}
            />
          }
          uplift={uplift}
        />
      </div>

      <div className="report__body">
        <div className="report-col">
          <div className="col-head">
            <span>§ A</span>
            <h3>Cortical response, {AXIS_ORDER.length} axes</h3>
          </div>

          <div className="emotions">
            {AXIS_ORDER.map((axis, i) => (
              <EmotionRow
                key={axis}
                axis={axis}
                idx={i}
                cohort={cohort[axis]}
                series={series[axis]}
                expectedDelta={result.predicted_uplift_per_axis[axis]}
              />
            ))}
          </div>

          <p className="emotions__legend">
            <span>
              <em className="legend-swatch is-bench" /> Bench (n={result.cohort.n})
            </span>
            <span>
              <em className="legend-swatch is-live" /> Your site
            </span>
            <span>
              <em className="legend-swatch is-friction" /> Friction axis
            </span>
            <span className="legend-rule">
              |z| ≥ 1 reads as anomaly
            </span>
          </p>

          <div className="col-head" style={{ marginTop: 28 }}>
            <span>§ B</span>
            <h3>Frames Claude asked to see</h3>
          </div>

          <div className="frames">
            {findings.asked_for_frame_indices.slice(0, 4).map((t, i) => {
              const f = framesByT[t]
              const flagged = findings.anomalies.some(a => a.frame_indices.includes(t))
              const tag = (() => {
                const a = findings.anomalies.find(x => x.frame_indices.includes(t))
                if (!a) return 'context'
                const arrow = a.axis === 'disgust' ? '↑' : '↓'
                return `${a.axis.replace('_', ' ')} ${arrow}`
              })()
              return (
                <div
                  key={t}
                  className={'frame ' + (flagged ? 'is-flagged' : '')}
                  style={{ '--frame-i': i, position: 'relative', overflow: 'hidden' }}
                >
                  {f && (
                    <img
                      src={f.data_url}
                      alt={`frame at t=${t}s`}
                      style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        objectFit: 'cover', opacity: 0.85,
                      }}
                    />
                  )}
                  <span className="frame__stamp" style={{ position: 'relative' }}>
                    t={String(t).padStart(2, '0')}
                  </span>
                  <span className="frame__tag" style={{ position: 'relative' }}>{tag}</span>
                </div>
              )
            })}
          </div>
          <p style={{
            fontSize: 13,
            fontFamily: 'var(--mono)',
            color: 'var(--ink-mute)',
            marginTop: 10,
            letterSpacing: '0.06em',
          }}>
            CLAUDE: "{findings.summary}"
          </p>
          {findings.history_note && (
            <p style={{
              fontSize: 12,
              fontFamily: 'var(--mono)',
              color: 'var(--ink-mute)',
              marginTop: 6,
              letterSpacing: '0.04em',
            }}>
              HISTORY NOTE: {findings.history_note}
            </p>
          )}
        </div>

        <div className="report-col">
          <div className="col-head">
            <span>§ C</span>
            <h3>What Claude recommends</h3>
          </div>

          <div className="findings">
            {patches.map((p, i) => {
              const cohortRow = cohort[p.target_axis]
              return (
                <article className="finding" key={`${p.unit_id}-${i}`}>
                  <div className="finding__num">{String(i + 1).padStart(2, '0')}</div>
                  <div>
                    <h4 className="finding__title">
                      {p.section ? `${p.section}.` : ''}
                      <span className="pulse">{p.unit_id.split('.').slice(-1)[0]}</span>
                      {' — '}{p.target_axis.replace('_', ' ')}
                    </h4>
                    <div className="finding__meta">
                      <span>SELECTOR · {p.selector}</span>
                      <span>
                        {p.target_axis.toUpperCase()}{' '}
                        {cohortRow.cohort_z >= 0 ? '+' : '−'}
                        {Math.abs(cohortRow.cohort_z).toFixed(2)}σ
                      </span>
                      <span>
                        Δz {p.expected_delta_z >= 0 ? '+' : '−'}
                        {Math.abs(p.expected_delta_z).toFixed(2)}
                      </span>
                    </div>
                    <p className="finding__body">{p.rationale}</p>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10,
                    }}>
                      <pre style={preStyle('before')}><code>{p.before_html}</code></pre>
                      <pre style={preStyle('after')}><code>{p.after_html}</code></pre>
                    </div>
                  </div>
                </article>
              )
            })}
            {patches.length === 0 && (
              <article className="finding">
                <div className="finding__num">—</div>
                <div>
                  <h4 className="finding__title">
                    {isDone ? 'Converged — no edits warranted.' : 'No anomalies above threshold.'}
                  </h4>
                  <p className="finding__body">
                    {isDone
                      ? 'All four axes are within ±0.5σ of the cohort baseline. Claude signalled `done`.'
                      : 'Cohort z-scores are within ±0.3σ across all axes. Recommend a cosmetic v2 only.'}
                  </p>
                </div>
              </article>
            )}
          </div>
        </div>
      </div>

      <div className="report__cta">
        <p>
          {isDone
            ? <>Brain says <span className="flame">this page is healthy</span>. Download the full report below.</>
            : <>Feed this iteration's patches back in and <span className="flame">run N more passes</span>. Claude sees the prior edits + score deltas on each call.</>
          }
        </p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={iterBoxStyle}>
            <label style={iterLabelStyle} htmlFor="iter-slider">
              Run more iterations <strong style={{ color: 'var(--ink)' }}>{iterCount}</strong>
            </label>
            <input
              id="iter-slider"
              type="range"
              min={1}
              max={8}
              step={1}
              value={iterCount}
              onChange={(e) => setIterCount(Number(e.target.value))}
              disabled={kicking || isDone}
              style={{ width: 180 }}
            />
            <button
              className="btn btn--xl"
              onClick={runMore}
              disabled={kicking || isDone}
              style={{ marginLeft: 10 }}
            >
              {kicking ? 'Kicking off…' : `Run ${iterCount} more`}
              <span className="btn__tag">
                {isDone ? 'already converged' : `each pass ≈ 3 min`}
              </span>
            </button>
          </div>
          <button className="btn btn--ghost" onClick={downloadReport}>
            Download report (.json)
          </button>
          <Link to="/" className="btn btn--ghost" style={{ textDecoration: 'none' }}>
            Scan another site
          </Link>
        </div>
        {kickErr && (
          <p style={{ color: '#d94040', fontFamily: 'var(--mono)', fontSize: 12, marginTop: 8 }}>
            {kickErr}
          </p>
        )}
      </div>
    </motion.section>
  )
}

function HistoryBreadcrumb({ chain, activeId, onJump }) {
  return (
    <div style={{
      margin: '14px 0 22px',
      padding: '10px 14px',
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: 10,
      background: 'rgba(0,0,0,0.02)',
      fontFamily: 'var(--mono)',
      fontSize: 12,
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--ink-mute)', marginBottom: 6 }}>
        ITERATION CHAIN · n={chain.length}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {chain.map((node, i) => {
          const active = node.job_id === activeId
          const z = node.cohort_z || {}
          const worst = Object.entries(z).reduce(
            (acc, [ax, v]) => {
              const bad = ax === 'disgust' ? v : -v
              return bad > acc.bad ? { axis: ax, z: v, bad } : acc
            },
            { axis: null, z: 0, bad: -Infinity },
          )
          return (
            <div key={node.job_id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => onJump(node.job_id)}
                title={node.diagnosis || ''}
                style={{
                  border: active ? '2px solid var(--ink)' : '1px solid rgba(0,0,0,0.2)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  background: active ? 'rgba(0,0,0,0.06)' : 'transparent',
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  cursor: 'pointer',
                  color: 'var(--ink)',
                }}
              >
                <strong>v{node.iteration_index + 1}</strong>
                {worst.axis && (
                  <span style={{ marginLeft: 6, color: 'var(--ink-mute)' }}>
                    {worst.axis.slice(0, 3)}{' '}
                    {worst.z >= 0 ? '+' : '−'}{Math.abs(worst.z).toFixed(2)}σ
                  </span>
                )}
                {node.done && (
                  <span style={{ marginLeft: 6, color: '#2e9e5e' }}>✓</span>
                )}
              </button>
              {i < chain.length - 1 && <span style={{ color: 'var(--ink-mute)' }}>→</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const iterBoxStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 12px',
  border: '1px solid rgba(0,0,0,0.14)',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.6)',
}

const iterLabelStyle = {
  fontFamily: 'var(--mono)',
  fontSize: 11,
  letterSpacing: '0.08em',
  color: 'var(--ink-mute)',
  textTransform: 'uppercase',
}

function preStyle(kind) {
  return {
    margin: 0,
    padding: '8px 10px',
    fontFamily: 'var(--mono)',
    fontSize: 11,
    lineHeight: 1.45,
    background: kind === 'before' ? 'rgba(220,53,69,0.06)' : 'rgba(38,143,255,0.07)',
    border: `1px solid ${kind === 'before' ? 'rgba(220,53,69,0.25)' : 'rgba(38,143,255,0.25)'}`,
    borderRadius: 6,
    overflow: 'hidden',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: 'var(--ink)',
  }
}
