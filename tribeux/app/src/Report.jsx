import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PAGE_VARIANTS, PAGE_TRANSITION } from './motion'

const EMOTIONS = [
  { key: 'attention',  name: 'Attention',          meta: 'FRONTO-PARIETAL · D29',    z: -1.28, friction: false },
  { key: 'self',       name: 'Self-relevance',     meta: 'DMN · PRECUNEUS',          z: -0.61, friction: false },
  { key: 'reward',     name: 'Reward',             meta: 'VENTRAL STRIATUM · VTA',   z: -1.74, friction: false },
  { key: 'affective',  name: 'Affective friction', alt: '(disgust)', meta: 'INSULA · ORBITO-FR.', z: +1.42, friction: true },
  { key: 'cognitive',  name: 'Cognitive friction', alt: '(conflict)', meta: 'ACC · dlPFC',         z: +0.92, friction: true },
]

function curve(seed, n = 60, amp = 1) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1)
    const a = Math.sin(seed + x * 6.3) * 0.55
    const b = Math.sin(seed * 2.1 + x * 12.7) * 0.28
    const c = Math.sin(seed * 0.7 + x * 3.1) * 0.3
    pts.push([x * 100, 50 - (a + b + c) * 18 * amp])
  }
  return pts
}

function toPath(pts) {
  return pts.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ')
}

function EmotionRow({ row, idx }) {
  const bench = useMemo(() => toPath(curve(idx + 1, 60, 0.6)), [idx])
  const live  = useMemo(() => toPath(curve(idx + 1.3 + row.z * 0.1, 60, 1 + Math.abs(row.z) * 0.2)), [idx, row.z])
  const zClass = Math.abs(row.z) >= 1 ? 'is-high' : 'is-good'
  const sign = row.z >= 0 ? '+' : '−'
  const val = Math.abs(row.z).toFixed(2)

  return (
    <div className="emotion-row">
      <div className="emotion-row__label">
        <strong>
          {row.name}
          {row.alt ? <span className="alt">{row.alt}</span> : null}
        </strong>
        <span>{row.meta}</span>
      </div>
      <div className="emotion-row__graph">
        <svg viewBox="0 0 100 60" preserveAspectRatio="none">
          <line className="zero" x1="0" y1="50" x2="100" y2="50" />
          <path className="bench" d={bench} />
          <path
            className={'live ' + (row.friction ? 'is-friction' : '')}
            d={live}
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

function StarburstBadge() {
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
        style={{ letterSpacing: '-0.02em' }}>+14%</text>
      <text x="70" y="88" textAnchor="middle"
        fontFamily="'Space Mono', monospace"
        fontWeight="700" fontSize="8.5"
        fill="oklch(0.16 0.010 260)"
        style={{ letterSpacing: '0.14em' }}>PREDICTED</text>
    </svg>
  )
}

export default function Report() {
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
            <span>FINDINGS · airbnb.com · 25.04.2026</span>
            <strong>3 ANOMALIES · 1 REDESIGN</strong>
          </div>
          <h1 className="report__title">
            Your hero is <s>calm.</s>&nbsp;
            <span className="flame">It's silent.</span>
          </h1>
        </div>
        <div className="report__verdict">
          <div className="report__verdict__z">
            <span className="num">−1.74</span>
            <span className="unit">Z-SCORE · REWARD AXIS · VENTRAL STRIATUM</span>
          </div>
          <p className="report__verdict__body">
            Predicted reward response sits 1.74σ below the benchmark. The first
            three seconds of the scan read as informational, not desirable.
          </p>
        </div>
      </div>

      <div className="report__body">
        <div className="report-col">
          <div className="col-head">
            <span>§ A</span>
            <h3>Cortical response, five axes</h3>
          </div>

          <div className="emotions">
            {EMOTIONS.map((e, i) => (
              <EmotionRow key={e.key} row={e} idx={i} />
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
            Dashed = benchmark mean (n=30). Solid = your site.
            Flame = tracked axis. Crimson = friction axis.
          </p>

          <div className="col-head" style={{ marginTop: 28 }}>
            <span>§ B</span>
            <h3>Frames Claude asked to see</h3>
          </div>

          <div className="frames">
            <div className="frame is-flagged" style={{ '--frame-i': 0 }}>
              <span className="frame__stamp">048</span>
              <span className="frame__tag">reward ↓</span>
            </div>
            <div className="frame is-flagged" style={{ '--frame-i': 1 }}>
              <span className="frame__stamp">101</span>
              <span className="frame__tag">friction ↑</span>
            </div>
            <div className="frame" style={{ '--frame-i': 2 }}>
              <span className="frame__stamp">147</span>
              <span className="frame__tag">neutral</span>
            </div>
            <div className="frame is-flagged" style={{ '--frame-i': 3 }}>
              <span className="frame__stamp">189</span>
              <span className="frame__tag">conflict ↑</span>
            </div>
          </div>
          <p style={{
            fontSize: 13,
            fontFamily: 'var(--mono)',
            color: 'var(--ink-mute)',
            marginTop: 10,
            letterSpacing: '0.06em',
          }}>
            CLAUDE: "I asked for these frames because the reward trace dips sharply
            here, and cognitive friction spikes right after. Something in the
            composition is asking too much, too soon."
          </p>
        </div>

        <div className="report-col">
          <div className="col-head">
            <span>§ C</span>
            <h3>What Claude recommends</h3>
          </div>

          <div className="findings">
            <article className="finding">
              <div className="finding__num">01</div>
              <div>
                <h4 className="finding__title">
                  The hero sub-headline is doing <span className="pulse">cognitive damage</span>.
                </h4>
                <div className="finding__meta">
                  <span>FRAME 101</span>
                  <span>FRICTION(C) +0.92σ</span>
                  <span>CONF · HIGH</span>
                </div>
                <p className="finding__body">
                  At frame 101 the viewer juggles six clauses before the CTA.
                  Predicted ACC activation exceeds benchmark by almost a full sigma.
                  Cut to one declarative clause; let the photograph carry the
                  emotion.
                </p>
              </div>
            </article>

            <article className="finding">
              <div className="finding__num">02</div>
              <div>
                <h4 className="finding__title">Reward never arrives.</h4>
                <div className="finding__meta">
                  <span>FRAMES 048 · 147</span>
                  <span>REWARD −1.74σ</span>
                  <span>CONF · MEDIUM</span>
                </div>
                <p className="finding__body">
                  Across the first four seconds the ventral striatum prediction
                  stays flat. Drop in a visual concrete noun (a place, a face, a
                  plate) inside the first scroll to lift reward.
                </p>
              </div>
            </article>

            <article className="finding">
              <div className="finding__num">03</div>
              <div>
                <h4 className="finding__title">
                  The CTA <span className="pulse">disgusts</span>, mildly.
                </h4>
                <div className="finding__meta">
                  <span>FRAME 189</span>
                  <span>FRICTION(A) +1.42σ</span>
                  <span>CONF · MEDIUM</span>
                </div>
                <p className="finding__body">
                  Insula activation spikes on the primary button. Likely causes:
                  color contrast against skin-tones in the photo, and the
                  exclamation in the label. Pick a calmer hue; drop the
                  punctuation.
                </p>
              </div>
            </article>
          </div>

          <div className="col-head" style={{ marginTop: 12 }}>
            <span>§ D</span>
            <h3>Before, after</h3>
          </div>

          <div className="diff">
            <div className="diff__side">
              <span className="diff__side__stamp">v1 · current</span>
              <img
                src="/airbnb-landing.png"
                alt="Current site hero"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', opacity: 0.94 }}
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            </div>
            <div className="diff__side is-after">
              <span className="diff__side__stamp">v2 · proposed</span>
              <img
                src="/sticker-brain-fire.png"
                alt="Proposed redesign"
                style={{
                  width: '72%', height: 'auto', position: 'absolute',
                  right: -20, bottom: -20, transform: 'rotate(6deg)', opacity: 0.55,
                  mixBlendMode: 'multiply',
                }}
              />
            </div>
            <StarburstBadge />
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
