import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PAGE_VARIANTS, PAGE_TRANSITION } from './motion'
import { useJob } from './lib/useAnalysis'

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
      <text x="70" y="68" textAnchor="middle"
        fontFamily="'Bricolage Grotesque', sans-serif"
        fontWeight="800" fontSize="22"
        fill="oklch(0.16 0.010 260)"
        style={{ letterSpacing: '-0.02em' }}>{sign}{Math.abs(pct)}%</text>
      <text x="70" y="88" textAnchor="middle"
        fontFamily="'Space Mono', monospace"
        fontWeight="700" fontSize="8.5"
        fill="oklch(0.16 0.010 260)"
        style={{ letterSpacing: '0.14em' }}>PREDICTED</text>
    </svg>
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
  const jobId = params.get('job')
  const { job, error } = useJob(jobId)

  if (!jobId) return <Loading label="NO JOB ID — START A SCAN" />
  if (error) return <Loading label={`ERROR · ${error}`} />
  if (!job || job.status !== 'done' || !job.result) return <Loading label={`PIPELINE · ${job?.status || 'queued'}`} />

  const { result } = job
  const v1 = result.v1.video_modality
  const cohort = v1.headline_scores_vs_cohort
  const series = v1.time_series_zscored
  const findings = result.findings
  const patches = result.applied_patches.map(ap => ap.proposal)

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

  const tape = `FINDINGS · ${result.url} · ${new Date(result.v1.metadata.scored_at_utc).toISOString().slice(0, 10)}`

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
            <span className="unit">Z-SCORE · {worst.axis.toUpperCase()} · {worstMeta.meta}</span>
          </div>
          <p className="report__verdict__body">
            {findings.summary}
          </p>
        </div>
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

          <p style={{
            fontSize: 12,
            fontFamily: 'var(--mono)',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--ink-mute)',
            marginTop: 4,
          }}>
            Dashed = benchmark mean (n={result.cohort.n}).
            Solid = your site (z-scored, {series.attention.length} timesteps).
            Crimson = friction axis.
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
                  <h4 className="finding__title">No anomalies above threshold.</h4>
                  <p className="finding__body">
                    Cohort z-scores are within ±0.3σ across all axes. Recommend a
                    cosmetic v2 only.
                  </p>
                </div>
              </article>
            )}
          </div>

          <div className="col-head" style={{ marginTop: 12 }}>
            <span>§ D</span>
            <h3>Before, after</h3>
          </div>

          <div className="diff">
            <div className="diff__side">
              <span className="diff__side__stamp">v1 · current</span>
              {result.screenshot_v1_data_url ? (
                <img src={result.screenshot_v1_data_url} alt="Current site"
                  style={diffImgStyle} />
              ) : (
                <img src="/airbnb-landing.png" alt="Current site" style={diffImgStyle}
                  onError={e => { e.currentTarget.style.display = 'none' }} />
              )}
            </div>
            <div className="diff__side is-after">
              <span className="diff__side__stamp">v2 · proposed</span>
              {result.screenshot_v2_data_url ? (
                <img src={result.screenshot_v2_data_url} alt="Proposed redesign"
                  style={diffImgStyle} />
              ) : (
                <img
                  src="/sticker-brain-fire.png"
                  alt="Proposed redesign"
                  style={{
                    width: '72%', height: 'auto', position: 'absolute',
                    right: -20, bottom: -20, transform: 'rotate(6deg)', opacity: 0.55,
                    mixBlendMode: 'multiply',
                  }}
                />
              )}
            </div>
            <StarburstBadge uplift={uplift} />
          </div>
        </div>
      </div>

      <div className="report__cta">
        <p>
          Want the <span className="flame">v2 patch</span> — copy, palette, and the
          frames Claude drew over — as a Figma link?
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn">Download patch</button>
          <Link to="/" className="btn btn--ghost" style={{ textDecoration: 'none' }}>
            Scan another site
          </Link>
        </div>
      </div>
    </motion.section>
  )
}

const diffImgStyle = {
  width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', opacity: 0.94,
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
