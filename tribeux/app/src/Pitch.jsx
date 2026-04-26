import { useCallback, useEffect, useState } from 'react'
import {
  AnimatePresence,
  motion,
  animate,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from 'framer-motion'
import { EASE_OUT_QUINT, PAGE_TRANSITION, PAGE_VARIANTS } from './motion'

/* ------------------------------------------------------------------ */
/*  Slide registry                                                      */
/* ------------------------------------------------------------------ */

const SLIDES = [
  { key: 'cover',         label: 'COVER'         },
  { key: 'hook',          label: 'HOOK'          },
  { key: 'validity',      label: 'WHY IT WORKS'  },
  { key: 'architecture',  label: 'ARCHITECTURE'  },
  { key: 'demo',          label: 'DEMO'          },
  { key: 'close',         label: 'CLOSE'         },
]

const TOTAL = SLIDES.length

const SLIDE_VARIANTS = {
  initial: (dir) => ({ opacity: 0, x: 24 * dir, filter: 'blur(8px)' }),
  animate: { opacity: 1, x: 0,           filter: 'blur(0px)'  },
  exit:    (dir) => ({ opacity: 0, x: -24 * dir, filter: 'blur(8px)' }),
}

const SLIDE_TRANSITION = { duration: 0.42, ease: EASE_OUT_QUINT }

/* Containers that stagger their direct children. */
const STAGGER_PARENT = {
  initial: {},
  animate: { transition: { staggerChildren: 0.09, delayChildren: 0.18 } },
  exit:    {},
}

const RISE_CHILD = {
  initial: { opacity: 0, y: 22, scale: 0.96, filter: 'blur(6px)' },
  animate: {
    opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
    transition: { duration: 0.46, ease: EASE_OUT_QUINT },
  },
}

/* ------------------------------------------------------------------ */
/*  Decorative bits                                                     */
/* ------------------------------------------------------------------ */

function Starburst({ label, color = 'pow' }) {
  const fill = color === 'flame' ? 'oklch(0.66 0.22 35)' : 'oklch(0.87 0.17 95)'
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <polygon
        points="60,4 70,32 96,18 88,48 118,52 94,70 116,92 86,88 94,118 66,100 60,120 54,100 26,118 34,88 4,92 26,70 2,52 32,48 24,18 50,32"
        fill={fill}
        stroke="oklch(0.16 0.010 260)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {label && (
        <text
          x="60" y="68"
          textAnchor="middle"
          fontFamily="'Bricolage Grotesque', sans-serif"
          fontWeight="800"
          fontSize="22"
          fill="oklch(0.16 0.010 260)"
          style={{ letterSpacing: '-0.02em' }}
        >{label}</text>
      )}
    </svg>
  )
}

function Tape({ children }) {
  return <div className="pitch__tape">{children}</div>
}

/* Word-by-word reveal for plain-string children. */
function Words({ text, className, delay = 0, reduceMotion }) {
  if (reduceMotion) {
    return <span className={className}>{text}</span>
  }
  const words = text.split(' ')
  return (
    <span className={className}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{
            duration: 0.42,
            delay: delay + i * 0.05,
            ease: EASE_OUT_QUINT,
          }}
          style={{ display: 'inline-block', willChange: 'transform' }}
        >
          {w}
          {i < words.length - 1 ? '\u00A0' : ''}
        </motion.span>
      ))}
    </span>
  )
}

/* Animated count-up. Triggers on mount via framer-motion's `animate`. */
function CountUp({ to, duration = 1.4, format }) {
  const reduceMotion = useReducedMotion()
  const v = useMotionValue(reduceMotion ? to : 0)
  const display = useTransform(v, (n) => (format ? format(n) : Math.round(n).toString()))
  useEffect(() => {
    if (reduceMotion) return
    const ctrl = animate(v, to, { duration, ease: EASE_OUT_QUINT })
    return () => ctrl.stop()
  }, [to, duration, v, reduceMotion])
  return <motion.span>{display}</motion.span>
}

/* ------------------------------------------------------------------ */
/*  Slides                                                              */
/* ------------------------------------------------------------------ */

function SlideCover() {
  const reduceMotion = useReducedMotion()
  return (
    <div className="pitch__slide pitch__slide--cover">
      <div className="pitch__cover-grid">
        <div>
          <Tape><span>FIG. 00</span> COMPOUND · 3 MIN</Tape>
          <h1 className="pitch__title">
            <Words text="User data" reduceMotion={reduceMotion} /><br />
            <Words text="without users." className="flame" delay={0.30} reduceMotion={reduceMotion} />
          </h1>
          <p className="pitch__lede">
            <strong>Compound</strong> predicts how the human brain responds to
            your website — before you ever ship it to one.
          </p>
          <div className="pitch__byline">
            <span className="pitch__byline-row">
              <span className="pitch__byline-key">EVENT</span>
              <span>To The Americas · April 25–26, 2026</span>
            </span>
            <span className="pitch__byline-row">
              <span className="pitch__byline-key">STACK</span>
              <span>TRIBE v2 · Claude · Pydantic AI · Logfire · Render · Mubit</span>
            </span>
          </div>
        </div>
        <figure className="pitch__cover-figure">
          <motion.img
            src="/sticker-browser-brain.png"
            alt="Halftone sticker — a browser window wrapped in a brain on fire."
            className="pitch__cover-sticker"
            initial={{ scale: 0.85, rotate: -6, opacity: 0 }}
            animate={{ scale: 1, rotate: -3, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: EASE_OUT_QUINT }}
          />
          <motion.div
            className="pitch__cover-pow"
            initial={{ scale: 0, rotate: -40, opacity: 0 }}
            animate={{ scale: 1, rotate: 8, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 14, delay: 0.7 }}
          >
            <Starburst label="POW" />
          </motion.div>
        </figure>
      </div>
    </div>
  )
}

function SlideHook() {
  const reduceMotion = useReducedMotion()
  return (
    <div className="pitch__slide pitch__slide--hook">
      <Tape><span>FIG. 01</span> WHERE WE ARE · APRIL 2026</Tape>

      <motion.div
        className="pitch__hook-stack"
        variants={STAGGER_PARENT}
        initial="initial"
        animate="animate"
      >
        <motion.h2 variants={RISE_CHILD} className="pitch__hook-line">
          <span className="pitch__hook-strike">A website used to take a year.</span>
        </motion.h2>
        <motion.h2 variants={RISE_CHILD} className="pitch__hook-line">
          Now it takes <span className="flame">a prompt.</span>
        </motion.h2>
        <motion.h2
          variants={RISE_CHILD}
          className="pitch__hook-line pitch__hook-line--big"
        >
          It still ships <span className="flame">without testing.</span>
        </motion.h2>
      </motion.div>

      <div className="pitch__hook-meter">
        <div className="pitch__hook-meter-row">
          <span className="pitch__hook-meter-label">LOVABLE APPS · 2025</span>
          <span className="pitch__hook-meter-bar pitch__hook-meter-bar--fill" />
          <span className="pitch__hook-meter-num">
            <CountUp
              to={8}
              duration={1.6}
              format={(n) => `${Math.round(n)}M+`}
            />
          </span>
        </div>
        <div className="pitch__hook-meter-row">
          <span className="pitch__hook-meter-label">USERS WHO TESTED THEM</span>
          <span className="pitch__hook-meter-bar pitch__hook-meter-bar--empty" />
          <span className="pitch__hook-meter-num pitch__hook-meter-num--alt">
            <Words text="≈ five strangers" reduceMotion={reduceMotion} delay={0.9} />
          </span>
        </div>
      </div>

      <p className="pitch__kicker">
        AI made shipping free. Validation never scaled with it.
      </p>
    </div>
  )
}

function SlideValidity() {
  return (
    <div className="pitch__slide pitch__slide--validity">
      <Tape><span>FIG. 02</span> WHY THIS WORKS</Tape>

      <h2 className="pitch__heading">
        Heatmaps measure 2 dimensions.<br />
        We model <span className="flame">148.</span>
      </h2>

      <motion.div
        className="pitch__validity-grid"
        variants={STAGGER_PARENT}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={RISE_CHILD} className="pitch__validity-cell">
          <div className="pitch__validity-num">
            <CountUp to={148} duration={1.4} />
          </div>
          <div className="pitch__validity-label">cortical regions</div>
          <div className="pitch__validity-body">
            modeled per second via Meta's <strong>TRIBE v2</strong> — an
            fMRI-trained transformer over the Destrieux atlas.
          </div>
        </motion.div>
        <motion.div variants={RISE_CHILD} className="pitch__validity-cell">
          <div className="pitch__validity-num">
            <CountUp to={30} duration={1.0} />
          </div>
          <div className="pitch__validity-label">production SaaS sites</div>
          <div className="pitch__validity-body">
            form the anomaly basis. We don't just predict response —
            we know which patterns mean trouble.
          </div>
        </motion.div>
        <motion.div variants={RISE_CHILD} className="pitch__validity-cell">
          <div className="pitch__validity-num">
            <CountUp to={90} duration={1.0} />s
          </div>
          <div className="pitch__validity-label">end&#8209;to&#8209;end</div>
          <div className="pitch__validity-body">
            URL in, anomaly trace + diagnosis + redesigned v2 video out.
            Closed loop, repeatable, no panel required.
          </div>
        </motion.div>
      </motion.div>

      <div className="pitch__quote">
        <span className="pitch__quote-mark">“</span>
        <p>
          We don't read clicks. We forward-pass an fMRI-grade model over a
          video of your page — and read predicted neural response,
          <strong>&nbsp;second by second.</strong>
        </p>
      </div>

      <p className="pitch__validity-stake">
        And the stakes: <strong><CountUp to={88} duration={1.4} />%</strong> of users
        never return after one bad experience. <em>—&nbsp;Adobe</em>
      </p>

      <div className="pitch__sources">
        SOURCES · Destrieux et al. 2010 <em>NeuroImage</em>
        &nbsp;·&nbsp; Meta AI · TRIBE v2 (March 2026)
        &nbsp;·&nbsp; Adobe Digital Trends
        &nbsp;·&nbsp; Nielsen Norman Group
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Architecture-slide subcomponents                                    */
/* ------------------------------------------------------------------ */

function ArchURL() {
  return (
    <div className="pitch__arch-node pitch__arch-url">
      <div className="pitch__arch-label">URL</div>
      <div className="pitch__arch-url-bar">
        <span className="pitch__arch-url-scheme">https://</span>
        <span className="pitch__arch-url-domain">stripe.com</span>
        <motion.span
          className="pitch__arch-caret"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
          aria-hidden="true"
        />
      </div>
      <div className="pitch__arch-sub">paste any link</div>
    </div>
  )
}

function ArchVideo() {
  return (
    <div className="pitch__arch-node pitch__arch-video">
      <div className="pitch__arch-label">10s VIDEO</div>
      <div className="pitch__arch-screen">
        <div className="pitch__arch-screen-bezel">
          <span /><span /><span />
        </div>
        <div className="pitch__arch-screen-page">
          {/* Faked Stripe-style scrolling page. The whole strip
              loops via CSS keyframes; everything inside is static. */}
          <div className="pitch__arch-stripe pitch__arch-stripe--hero">
            <div className="pitch__arch-stripe-nav">
              <span /><span /><span /><span />
            </div>
            <div className="pitch__arch-stripe-h1" />
            <div className="pitch__arch-stripe-h1 pitch__arch-stripe-h1--alt" />
            <div className="pitch__arch-stripe-sub" />
            <div className="pitch__arch-stripe-cta-row">
              <div className="pitch__arch-stripe-cta" />
              <div className="pitch__arch-stripe-cta pitch__arch-stripe-cta--ghost" />
            </div>
          </div>
          <div className="pitch__arch-stripe pitch__arch-stripe--logos">
            <span /><span /><span /><span /><span />
          </div>
          <div className="pitch__arch-stripe pitch__arch-stripe--cards">
            <div /><div /><div />
          </div>
          <div className="pitch__arch-stripe pitch__arch-stripe--code">
            <span className="pitch__arch-stripe-line" />
            <span className="pitch__arch-stripe-line" />
            <span className="pitch__arch-stripe-line pitch__arch-stripe-line--short" />
            <span className="pitch__arch-stripe-line" />
          </div>
          <div className="pitch__arch-stripe pitch__arch-stripe--footer" />
        </div>
      </div>
      <div className="pitch__arch-sub">scroll-recorded headlessly</div>
    </div>
  )
}

function ArchBrain() {
  const regions = [
    { cx: 42, cy: 50, r: 13, delay: 0.0,  c: 'flame' },
    { cx: 78, cy: 36, r: 11, delay: 0.45, c: 'pow'   },
    { cx: 96, cy: 60, r: 12, delay: 0.85, c: 'flame' },
    { cx: 60, cy: 76, r: 10, delay: 1.20, c: 'pow'   },
    { cx: 30, cy: 78, r:  9, delay: 0.65, c: 'flame' },
  ]
  return (
    <div className="pitch__arch-node pitch__arch-brain">
      <div className="pitch__arch-label pitch__arch-label--accent">TRIBE v2</div>
      <svg viewBox="0 0 130 120" className="pitch__arch-brain-svg" aria-hidden="true">
        <path
          d="M 25 60 C 22 28, 60 12, 82 24 C 112 30, 118 60, 100 84 C 88 104, 48 102, 28 86 Z"
          fill="var(--paper-2)"
          stroke="var(--ink)"
          strokeWidth="2"
        />
        {/* sulci */}
        <path d="M 50 30 C 55 50, 50 70, 60 90" fill="none" stroke="var(--ink-mute)" strokeWidth="1" opacity="0.5" />
        <path d="M 78 28 C 70 50, 80 70, 70 95" fill="none" stroke="var(--ink-mute)" strokeWidth="1" opacity="0.5" />
        {regions.map((r, i) => (
          <motion.circle
            key={i}
            cx={r.cx}
            cy={r.cy}
            r={r.r}
            fill={r.c === 'flame' ? 'var(--flame)' : 'var(--pow)'}
            stroke="var(--ink)"
            strokeWidth="1"
            initial={{ scale: 0.6, opacity: 0.3 }}
            animate={{
              scale: [0.6, 1.18, 0.6],
              opacity: [0.35, 0.9, 0.35],
            }}
            transition={{
              duration: 2,
              delay: r.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ transformOrigin: 'center center', transformBox: 'fill-box' }}
          />
        ))}
      </svg>
      <div className="pitch__arch-sub">148 cortical regions / sec</div>
    </div>
  )
}

function ArchGraph() {
  return (
    <div className="pitch__arch-node pitch__arch-graph">
      <div className="pitch__arch-label">PREDICTED</div>
      <svg viewBox="0 0 140 80" className="pitch__arch-graph-svg" preserveAspectRatio="none" aria-hidden="true">
        {/* grid */}
        <line x1="0" y1="60" x2="140" y2="60" stroke="var(--hairline-2)" strokeWidth="0.5" />
        <line x1="0" y1="40" x2="140" y2="40" stroke="var(--hairline-2)" strokeWidth="0.5" strokeDasharray="2 3" />
        <line x1="0" y1="20" x2="140" y2="20" stroke="var(--hairline-2)" strokeWidth="0.5" />
        {/* time axis ticks */}
        <line x1="0" y1="75" x2="140" y2="75" stroke="var(--ink)" strokeWidth="0.5" opacity="0.4" />
        {[0, 28, 56, 84, 112, 140].map((x, i) => (
          <line key={i} x1={x} y1="73" x2={x} y2="77" stroke="var(--ink)" strokeWidth="0.5" opacity="0.4" />
        ))}
        {/* reward (dips at 0:04 = ~x60) */}
        <motion.path
          d="M 0 30 L 20 28 L 40 32 L 60 55 L 80 50 L 100 35 L 120 28 L 140 22"
          fill="none"
          stroke="var(--flame)"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.0, ease: 'linear', repeat: Infinity, repeatType: 'loop', repeatDelay: 0.6 }}
        />
        {/* valence */}
        <motion.path
          d="M 0 40 L 30 42 L 50 38 L 80 45 L 110 36 L 140 32"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray="3 2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.2, delay: 0.2, ease: 'linear', repeat: Infinity, repeatDelay: 0.5 }}
        />
        {/* surprise */}
        <motion.path
          d="M 0 50 L 25 48 L 55 55 L 85 48 L 115 52 L 140 50"
          fill="none"
          stroke="var(--ink-mute)"
          strokeWidth="1.2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.4, delay: 0.35, ease: 'linear', repeat: Infinity, repeatDelay: 0.5 }}
        />
        {/* attention */}
        <motion.path
          d="M 0 25 L 20 30 L 40 28 L 60 38 L 80 42 L 100 30 L 140 25"
          fill="none"
          stroke="var(--good, oklch(0.72 0.18 145))"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray="3 2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.6, delay: 0.5, ease: 'linear', repeat: Infinity, repeatDelay: 0.5 }}
        />
        {/* anomaly marker at the dip */}
        <motion.circle
          cx="60"
          cy="55"
          r="3.4"
          fill="var(--flame)"
          stroke="var(--ink)"
          strokeWidth="1.4"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 1] }}
          transition={{ duration: 0.6, delay: 1.2, repeat: Infinity, repeatDelay: 1.9 }}
          style={{ transformOrigin: 'center center', transformBox: 'fill-box' }}
        />
      </svg>
      <div className="pitch__arch-sub">5 metrics × 10 seconds</div>
    </div>
  )
}

function ArchHTML() {
  const [v, setV] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setV((x) => 1 - x), 2600)
    return () => clearInterval(t)
  }, [])
  const v1 = (
    <>
      <span className="pitch__arch-code-tag">&lt;button</span>{' '}
      <span className="pitch__arch-code-attr">class</span>=<span className="pitch__arch-code-str">"cta-sm"</span><span className="pitch__arch-code-tag">&gt;</span>{'\n'}
      {'  '}Start now{'\n'}
      <span className="pitch__arch-code-tag">&lt;/button&gt;</span>
    </>
  )
  const v2 = (
    <>
      <span className="pitch__arch-code-tag">&lt;button</span>{' '}
      <span className="pitch__arch-code-attr">class</span>=<span className="pitch__arch-code-str">"cta-hero"</span><span className="pitch__arch-code-tag">&gt;</span>{'\n'}
      {'  '}Start free →{'\n'}
      <span className="pitch__arch-code-tag">&lt;/button&gt;</span>
    </>
  )
  return (
    <div className="pitch__arch-node pitch__arch-html">
      <div className="pitch__arch-label">CLAUDE EDITS HTML</div>
      <div className="pitch__arch-code">
        <div className="pitch__arch-code-tabs">
          <span className={v === 0 ? 'is-active' : ''}>v1.html</span>
          <span className={v === 1 ? 'is-active' : ''}>v2.html</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.pre
            key={v}
            className="pitch__arch-code-body"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.36, ease: EASE_OUT_QUINT }}
          >
            {v === 0 ? v1 : v2}
          </motion.pre>
        </AnimatePresence>
      </div>
      <div className="pitch__arch-sub">re-renders to v2 video</div>
    </div>
  )
}

function ArchArrow() {
  return (
    <svg className="pitch__arch-arrow" viewBox="0 0 36 16" aria-hidden="true">
      <motion.line
        x1="0" y1="8" x2="30" y2="8"
        stroke="var(--ink)"
        strokeWidth="2"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: EASE_OUT_QUINT }}
      />
      <motion.polygon
        points="30,2 36,8 30,14"
        fill="var(--ink)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.6 }}
      />
    </svg>
  )
}

function ArchLoop() {
  return (
    <svg
      className="pitch__arch-loop"
      viewBox="0 0 1000 120"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="arch-arrow-end"
          markerWidth="10"
          markerHeight="10"
          refX="6"
          refY="5"
          orient="auto"
        >
          <polygon points="0 0, 10 5, 0 10" fill="var(--flame)" />
        </marker>
      </defs>
      <motion.path
        d="M 870 8 Q 870 95 500 95 Q 360 95 360 18"
        fill="none"
        stroke="var(--flame)"
        strokeWidth="2"
        strokeDasharray="6 4"
        markerEnd="url(#arch-arrow-end)"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, delay: 0.6, ease: EASE_OUT_QUINT }}
      />
      <text
        x="500"
        y="86"
        fontFamily="var(--mono)"
        fontSize="11"
        fill="var(--flame-deep, oklch(0.55 0.22 35))"
        letterSpacing="0.18em"
        textAnchor="middle"
        fontWeight="700"
      >
        OPTIMISER LOOP
      </text>
    </svg>
  )
}

function SlideArchitecture() {
  return (
    <div className="pitch__slide pitch__slide--arch">
      <Tape><span>FIG. 03</span> ARCHITECTURE</Tape>

      <h2 className="pitch__heading">
        URL in. <span className="flame">Redesign out.</span><br />
        Scored, diagnosed, rewritten — on a closed loop.
      </h2>

      <motion.div
        className="pitch__arch-flow"
        variants={STAGGER_PARENT}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={RISE_CHILD}><ArchURL /></motion.div>
        <motion.div variants={RISE_CHILD} className="pitch__arch-arrow-wrap"><ArchArrow /></motion.div>
        <motion.div variants={RISE_CHILD}><ArchVideo /></motion.div>
        <motion.div variants={RISE_CHILD} className="pitch__arch-arrow-wrap"><ArchArrow /></motion.div>
        <motion.div variants={RISE_CHILD}><ArchBrain /></motion.div>
        <motion.div variants={RISE_CHILD} className="pitch__arch-arrow-wrap"><ArchArrow /></motion.div>
        <motion.div variants={RISE_CHILD}><ArchGraph /></motion.div>
        <motion.div variants={RISE_CHILD} className="pitch__arch-arrow-wrap"><ArchArrow /></motion.div>
        <motion.div variants={RISE_CHILD}><ArchHTML /></motion.div>
      </motion.div>

      <ArchLoop />

      <p className="pitch__kicker">
        ~&nbsp;90 seconds, end to end. <span className="flame">No live traffic. No A/B. No panel.</span>
      </p>
    </div>
  )
}

function SlideDemo() {
  return (
    <div className="pitch__slide pitch__slide--demo">
      <Tape><span>FIG. 04</span> DEMO · LIVE</Tape>

      <h2 className="pitch__heading">
        0:04 — predicted reward<br />
        collapses in <span className="flame">visual cortex.</span>
      </h2>

      <div className="pitch__demo-stage">
        <motion.figure
          className="pitch__demo-frame pitch__demo-frame--before"
          initial={{ opacity: 0, x: -28, rotate: -3 }}
          animate={{ opacity: 1, x: 0, rotate: -1.2 }}
          transition={{ duration: 0.55, delay: 0.2, ease: EASE_OUT_QUINT }}
        >
          <figcaption>BEFORE · v1</figcaption>
          <img src="/airbnb-mock.png" alt="The original homepage frame at second 04." />
          <motion.span
            className="pitch__demo-stamp pitch__demo-stamp--bad"
            initial={{ scale: 0.6, rotate: -10, opacity: 0 }}
            animate={{ scale: 1, rotate: -4, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 0.65 }}
          >
            <span className="pitch__demo-stamp-tag">PREDICTED</span>
            REWARD&nbsp;
            <CountUp
              to={-38}
              duration={1.0}
              format={(n) => `↓ ${Math.abs(Math.round(n))}%`}
            />
          </motion.span>
        </motion.figure>

        <div className="pitch__demo-pipe">
          <motion.div
            className="pitch__demo-pipe-line"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.7, delay: 0.5, ease: EASE_OUT_QUINT }}
            style={{ transformOrigin: 'left center' }}
          />
          <motion.div
            className="pitch__demo-pipe-row"
            variants={STAGGER_PARENT}
            initial="initial"
            animate="animate"
            transition={{ delayChildren: 0.5 }}
          >
            <motion.span variants={RISE_CHILD} className="pitch__demo-pipe-step">URL</motion.span>
            <motion.span variants={RISE_CHILD}>›</motion.span>
            <motion.span variants={RISE_CHILD} className="pitch__demo-pipe-step">VIDEO</motion.span>
            <motion.span variants={RISE_CHILD}>›</motion.span>
            <motion.span variants={RISE_CHILD} className="pitch__demo-pipe-step pitch__demo-pipe-step--accent">TRIBE v2</motion.span>
            <motion.span variants={RISE_CHILD}>›</motion.span>
            <motion.span variants={RISE_CHILD} className="pitch__demo-pipe-step">CLAUDE</motion.span>
            <motion.span variants={RISE_CHILD}>›</motion.span>
            <motion.span variants={RISE_CHILD} className="pitch__demo-pipe-step">v2</motion.span>
          </motion.div>
          <motion.div
            className="pitch__demo-pipe-meta"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 1.3 }}
          >
            ~ 90 seconds, end to end
          </motion.div>
        </div>

        <motion.figure
          className="pitch__demo-frame pitch__demo-frame--after"
          initial={{ opacity: 0, x: 28, rotate: 3 }}
          animate={{ opacity: 1, x: 0, rotate: 1 }}
          transition={{ duration: 0.55, delay: 1.0, ease: EASE_OUT_QUINT }}
        >
          <figcaption>AFTER · v2</figcaption>
          <img src="/airbnb-mock.png" alt="The redesigned homepage frame at second 04." />
          <motion.span
            className="pitch__demo-stamp pitch__demo-stamp--good"
            initial={{ scale: 0.6, rotate: 12, opacity: 0 }}
            animate={{ scale: 1, rotate: 4, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 1.5 }}
          >
            <span className="pitch__demo-stamp-tag">PREDICTED</span>
            REWARD&nbsp;
            <CountUp
              to={14}
              duration={1.0}
              format={(n) => `↑ +${Math.round(n)}%`}
            />
          </motion.span>
        </motion.figure>
      </div>

      <motion.ul
        className="pitch__demo-recs"
        variants={STAGGER_PARENT}
        initial="initial"
        animate="animate"
        transition={{ delayChildren: 1.7 }}
      >
        <motion.li variants={RISE_CHILD}>
          <span className="pitch__demo-tick">·</span>
          0:04 — predicted reward signal collapses; hero CTA fell below visual weight. Re-staged.
        </motion.li>
        <motion.li variants={RISE_CHILD}>
          <span className="pitch__demo-tick">·</span>
          Affective valence dips on second card — replace stock photo.
        </motion.li>
        <motion.li variants={RISE_CHILD}>
          <span className="pitch__demo-tick">·</span>
          Footer dominates surprise score — cut by 40%.
        </motion.li>
      </motion.ul>
    </div>
  )
}

function SlideClose() {
  return (
    <div className="pitch__slide pitch__slide--close">
      <Tape><span>FIG. 05</span> CLOSE</Tape>

      <h2 className="pitch__close-title">
        Every PR ships through<br />
        <span className="flame">Compound.</span>
      </h2>

      <p className="pitch__close-lede">
        AI shipped the code. We finished the loop. The first time a model
        gets to see your page through a human, before a human sees it at all.
      </p>

      <motion.div
        className="pitch__close-pill"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25, ease: EASE_OUT_QUINT }}
      >
        <span className="pitch__close-pill-num">URL ▸</span>
        <span className="pitch__close-pill-input">your-website.com</span>
        <span className="pitch__close-pill-cta">SCAN</span>
      </motion.div>

      <p className="pitch__close-ab">
        A/B testing measures clicks <em>after</em> you ship.<br />
        We model the brain <span className="flame">before.</span>
      </p>

      <p className="pitch__close-question">
        What if no design ever had to ship blind again?
      </p>

      <div className="pitch__close-foot">
        <span>BUILT IN 24 HOURS</span>
        <span>·</span>
        <span>APPLE ML INTERN · IMPERIAL CS · 3× HACKATHON WINNER</span>
      </div>

      <motion.div
        className="pitch__close-pow"
        initial={{ scale: 0, rotate: -40, opacity: 0 }}
        animate={{ scale: 1, rotate: 10, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 14, delay: 0.5 }}
      >
        <Starburst label="GO" color="flame" />
      </motion.div>
    </div>
  )
}

const SLIDE_COMPONENTS = {
  cover:        SlideCover,
  hook:         SlideHook,
  validity:     SlideValidity,
  architecture: SlideArchitecture,
  demo:         SlideDemo,
  close:        SlideClose,
}

/* ------------------------------------------------------------------ */
/*  Container                                                           */
/* ------------------------------------------------------------------ */

export default function Pitch() {
  const [{ idx, dir }, setState] = useState({ idx: 0, dir: 1 })

  const goTo = useCallback((target) => {
    setState((prev) => {
      const clamped = Math.max(0, Math.min(TOTAL - 1, target))
      if (clamped === prev.idx) return prev
      return { idx: clamped, dir: clamped > prev.idx ? 1 : -1 }
    })
  }, [])

  const goNext = useCallback(() => {
    setState((prev) => {
      const next = Math.min(TOTAL - 1, prev.idx + 1)
      if (next === prev.idx) return prev
      return { idx: next, dir: 1 }
    })
  }, [])

  const goPrev = useCallback(() => {
    setState((prev) => {
      const next = Math.max(0, prev.idx - 1)
      if (next === prev.idx) return prev
      return { idx: next, dir: -1 }
    })
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'Home') {
        e.preventDefault()
        goTo(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        goTo(TOTAL - 1)
      } else if (/^[1-9]$/.test(e.key)) {
        const n = parseInt(e.key, 10) - 1
        if (n < TOTAL) goTo(n)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, goNext, goPrev])

  const current = SLIDES[idx]
  const Component = SLIDE_COMPONENTS[current.key]

  return (
    <motion.section
      className="pitch"
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={PAGE_TRANSITION}
    >
      <div className="pitch__rule" aria-hidden="true" />
      <div className="pitch__stage">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={current.key}
            className="pitch__slide-shell"
            variants={SLIDE_VARIANTS}
            custom={dir}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={SLIDE_TRANSITION}
          >
            <Component />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="pitch__chrome">
        <div className="pitch__counter">
          <span className="pitch__counter-num">{String(idx + 1).padStart(2, '0')}</span>
          <span className="pitch__counter-sep">/</span>
          <span className="pitch__counter-tot">{String(TOTAL).padStart(2, '0')}</span>
          <span className="pitch__counter-label">{current.label}</span>
        </div>

        <div className="pitch__dots" role="tablist" aria-label="Slide navigation">
          {SLIDES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`Slide ${i + 1}: ${s.label}`}
              className={'pitch__dot' + (i === idx ? ' is-active' : '')}
              onClick={() => goTo(i)}
            />
          ))}
        </div>

        <div className="pitch__controls">
          <button
            type="button"
            className="pitch__ctrl"
            onClick={goPrev}
            disabled={idx === 0}
            aria-label="Previous slide"
          >‹ PREV</button>
          <button
            type="button"
            className="pitch__ctrl pitch__ctrl--primary"
            onClick={goNext}
            disabled={idx === TOTAL - 1}
            aria-label="Next slide"
          >NEXT ›</button>
        </div>
      </div>
    </motion.section>
  )
}
