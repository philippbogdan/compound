import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import BrainCanvas from './BrainCanvas'
import { EASE_OUT_QUINT, PAGE_VARIANTS, PAGE_TRANSITION } from './motion'

const STAGES = [
  { key: 'render',    label: 'RENDER',     long: 'Scrolling capture',                 ms:  9000 },
  { key: 'encode',    label: 'ENCODE',     long: '256×256 stimulus film',             ms:  6000 },
  { key: 'tribe',     label: 'TRIBE v2',   long: 'Cortical response, frame by frame', ms: 14000 },
  { key: 'project',   label: 'PROJECT',    long: 'Destrieux to affective axes',       ms:  6000 },
  { key: 'benchmark', label: 'BENCHMARK',  long: 'Z-score vs n=30 corpus',            ms:  4000 },
  { key: 'claude',    label: 'CLAUDE',     long: 'Anomaly review',                    ms:  9000 },
  { key: 'frames',    label: 'FRAMES',     long: 'Pull frames for inspection',        ms:  3000 },
  { key: 'compose',   label: 'COMPOSE',    long: 'Write findings',                    ms:  4000 },
]

// Stages where the live benchmark sparkline should pause so it doesn't
// compete with what the user is supposed to be reading.
const QUIET_STAGES = new Set(['claude', 'compose'])

const LOG_ENTRIES = [
  ['00:00', 'render',    'playwright.chromium.headless · viewport 1440×900 · devicePixelRatio 2'],
  ['00:02', 'render',    'scroll capture · 4.8 s · 24 fps · 115 frames'],
  ['00:07', 'encode',    'torchvision.io.read_video → tensor [1, 115, 256, 256, 3] fp16'],
  ['00:09', 'tribe',     'torch.load(tribev2.pt) · cuda:0 · 2.1B params · sha256:7f2a…9be'],
  ['00:13', 'tribe',     'forward() · 18.2 ms/frame · mean activation 0.613'],
  ['00:18', 'tribe',     'destrieux.map(acts, regions=115) · coverage 98.2%'],
  ['00:22', 'project',   'project → axes [attention, self, reward, friction_a, friction_c]'],
  ['00:26', 'benchmark', 'corpus n=30 · z = (x − μ) / σ · axis-wise'],
  ['00:29', 'claude',    'flagged: reward_trace < benchmark at t=2.1s · z=−1.74'],
  ['00:32', 'claude',    'flagged: friction_c spike at scroll_depth=0.62 · z=+0.92'],
  ['00:36', 'frames',    'ffmpeg extract · frames [048, 101, 147, 189] → png 256²'],
  ['00:38', 'compose',   'claude.messages.create · model=claude-opus-4-7 · 3 findings'],
  ['00:41', 'compose',   'patch.figma → variant v2 · predicted_uplift=+0.14'],
]

const VERDICT_BEAT_MS = 1400

export default function Demo() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const urlFromQuery = params.get('url') || 'stripe.com'

  const isStripe = /(^|\.)stripe\.com(\/|$)/i.test(urlFromQuery) || /^stripe(\.com)?$/i.test(urlFromQuery.trim())

  const [activeIdx, setActiveIdx] = useState(0)
  const [visibleLogs, setVisibleLogs] = useState(1)
  const [bars, setBars] = useState(() => Array(24).fill(0.3))
  const tRef = useRef(0)

  const isComplete = activeIdx >= STAGES.length
  const activeKey = STAGES[Math.min(activeIdx, STAGES.length - 1)].key
  const sparklineQuiet = !isComplete && QUIET_STAGES.has(activeKey)

  useEffect(() => {
    if (isComplete) {
      const t = setTimeout(() => nav('/report'), VERDICT_BEAT_MS)
      return () => clearTimeout(t)
    }
    const dur = STAGES[activeIdx].ms * 0.35
    const t = setTimeout(() => setActiveIdx(i => i + 1), dur)
    return () => clearTimeout(t)
  }, [activeIdx, isComplete, nav])

  useEffect(() => {
    if (isComplete) return undefined
    const t = setInterval(() => {
      setVisibleLogs(v => Math.min(v + 1, LOG_ENTRIES.length))
    }, 900)
    return () => clearInterval(t)
  }, [isComplete])

  useEffect(() => {
    if (sparklineQuiet || isComplete) return undefined
    const t = setInterval(() => {
      setBars(prev => {
        const next = prev.slice(1)
        tRef.current += 0.18
        const y = 0.45 + Math.sin(tRef.current) * 0.27 + Math.sin(tRef.current * 2.3) * 0.09 + (Math.random() - 0.5) * 0.12
        next.push(Math.max(0.08, Math.min(1, y)))
        return next
      })
    }, sparklineQuiet ? 320 : 200)
    return () => clearInterval(t)
  }, [sparklineQuiet, isComplete])

  const currentCopy = useMemo(() => STAGES[Math.min(activeIdx, STAGES.length - 1)], [activeIdx])

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
        {STAGES.map((s, i) => {
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
              style={{ '--stage-ms': `${Math.round(s.ms * 0.35)}ms` }}
            >
              <span className="stage-row__num">{String(i + 1).padStart(2, '0')}</span>
              <span>{s.label}</span>
              <span className="stage-row__dur">{(s.ms / 1000).toFixed(0)}s</span>
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
            {isComplete ? 'Verdict' : `Step ${activeIdx + 1}/${STAGES.length}`}
          </span>
        </div>

        <div className="scan__video">
          <div className="scan__video-frame" aria-label="256 by 256 stimulus preview">
            <AnimatePresence>
              {isStripe && (
                <motion.video
                  key="stimulus-stripe"
                  src="/stripe-scan.mp4"
                  autoPlay muted loop playsInline
                  className="scan__video-media"
                  initial={{ opacity: 0, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.34, ease: EASE_OUT_QUINT }}
                />
              )}
            </AnimatePresence>
            <span className="scan__video-frame__sweep" aria-hidden="true" />
            <span className="scan__video-frame__stamp">256 × 256</span>
            <span className="scan__video-frame__time">t = {(activeIdx * 0.6).toFixed(1)}s</span>

            <AnimatePresence>
              {isComplete && (
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
                    FIG. 02 — VERDICT
                  </motion.span>
                  <motion.span
                    className="scan__verdict-overlay__num"
                    initial={{ opacity: 0, scale: 0.7, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.5, ease: EASE_OUT_QUINT, delay: 0.12 }}
                  >
                    −1.74σ
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
                <><span className="flame">{currentCopy.label}</span> · {currentCopy.long}</>
              )}
            </dd>
            <dt>Stimulus</dt>
            <dd>4.8 s scrolling film · 24 fps · downsampled</dd>
            <dt>Cortex model</dt>
            <dd>TRIBE v2 · Destrieux · 115 regions</dd>
          </dl>
        </div>

        <div className="scan__log" role="log" aria-live="polite">
          {LOG_ENTRIES.slice(0, visibleLogs).map((line, i) => (
            <div className="log-line" key={i} style={{ animationDelay: `${i * 40}ms` }}>
              <span>{line[0]}</span>
              <span>{line[1]}</span>
              <span>{line[2]}</span>
            </div>
          ))}
        </div>
      </div>

      <aside className="scan__aside">
        <div className={'scan__aside__section' + (isComplete ? ' is-fading' : '')}>
          <h5>Live cortex · fsaverage5</h5>
          <div className="scan__brain">
            <BrainCanvas width={268} height={268} autoRotate brightness={1.05} />
          </div>
          <p className="scan__brain__caption">
            <strong>TRIBE v2 · 2.1B params</strong>
            <span>115 regions · fp16 · cuda:0</span>
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
            Z = −1.28 · reward-axis · hero
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
