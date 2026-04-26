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
  { key: 'architecture',  label: 'ARCHITECTURE'  },
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
      <div className="landing__grid">
        <div>
          <div className="landing__tape">
            <span>FIG. 01</span>
            NEURAL RESPONSE, PREDICTED
          </div>
          <h1 className="landing__title">
            <Words text="User" reduceMotion={reduceMotion} />{' '}
            <Words text="testing," className="flame" delay={0.20} reduceMotion={reduceMotion} /><br />
            <Words text="without users." delay={0.45} reduceMotion={reduceMotion} />
          </h1>
        </div>
        <figure className="landing__figure">
          <motion.img
            src="/sticker-browser-brain.png"
            alt="Halftone sticker — a browser window wrapped in a brain on fire, encircled by arrows"
            className="landing__sticker"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: EASE_OUT_QUINT }}
          />
          <motion.div
            className="landing__figure__pow"
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
      <Tape><span>FIG. 02</span> WHERE WE ARE · APRIL 2026</Tape>

      <motion.div
        className="pitch__hook-stack"
        variants={STAGGER_PARENT}
        initial="initial"
        animate="animate"
      >
        <motion.h2 variants={RISE_CHILD} className="pitch__hook-line">
          <span className="pitch__hook-strike">A product used to take a year.</span>
        </motion.h2>
        <motion.h2 variants={RISE_CHILD} className="pitch__hook-line">
          Now it takes <span className="flame">a prompt.</span>
        </motion.h2>
        <motion.h2
          variants={RISE_CHILD}
          className="pitch__hook-line pitch__hook-line--big"
        >
          So <span className="flame">distribution is key.</span>
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
      {/* "optimised" label — sits in the U of the loop, with a paper-coloured
          backing rect so the dashed arrow doesn't visually run through it. */}
      <rect
        x="455"
        y="80"
        width="90"
        height="18"
        fill="var(--paper)"
        rx="2"
      />
      <text
        x="500"
        y="93"
        fontFamily="var(--mono)"
        fontSize="13"
        fill="var(--flame-deep, oklch(0.55 0.22 35))"
        letterSpacing="0"
        textAnchor="middle"
        fontWeight="600"
      >
        optimised
      </text>
    </svg>
  )
}

function SlideArchitecture({ showLoop = false }) {
  return (
    <div className="pitch__slide pitch__slide--arch pitch__slide--arch-bare">
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

      {showLoop && <ArchLoop />}
    </div>
  )
}

const SLIDE_COMPONENTS = {
  cover:        SlideCover,
  hook:         SlideHook,
  architecture: SlideArchitecture,
}

/* ------------------------------------------------------------------ */
/*  Container                                                           */
/* ------------------------------------------------------------------ */

export default function Pitch() {
  /* archSub gates the architecture slide's optimiser-loop reveal:
     0 = bare diagram, 1 = loop arrow + 'optimised' label visible. */
  const [{ idx, dir, archSub }, setState] = useState({ idx: 0, dir: 1, archSub: 0 })

  const goTo = useCallback((target) => {
    setState((prev) => {
      const clamped = Math.max(0, Math.min(TOTAL - 1, target))
      if (clamped === prev.idx && prev.archSub === 0) return prev
      return { idx: clamped, dir: clamped > prev.idx ? 1 : -1, archSub: 0 }
    })
  }, [])

  const goNext = useCallback(() => {
    setState((prev) => {
      const onArch = SLIDES[prev.idx].key === 'architecture'
      if (onArch && prev.archSub === 0) {
        return { ...prev, archSub: 1 }
      }
      const next = Math.min(TOTAL - 1, prev.idx + 1)
      if (next === prev.idx) return prev
      return { idx: next, dir: 1, archSub: 0 }
    })
  }, [])

  const goPrev = useCallback(() => {
    setState((prev) => {
      const onArch = SLIDES[prev.idx].key === 'architecture'
      if (onArch && prev.archSub === 1) {
        return { ...prev, archSub: 0 }
      }
      const next = Math.max(0, prev.idx - 1)
      if (next === prev.idx) return prev
      return { idx: next, dir: -1, archSub: 0 }
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
  const showLoop = current.key === 'architecture' && archSub > 0
  const atDeckEnd = idx === TOTAL - 1 && (current.key !== 'architecture' || archSub === 1)

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
            <Component showLoop={showLoop} />
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
            disabled={atDeckEnd}
            aria-label="Next slide"
          >NEXT ›</button>
        </div>
      </div>
    </motion.section>
  )
}
