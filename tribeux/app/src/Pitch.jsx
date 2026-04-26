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
  { key: 'cover',     label: 'COVER'     },
  { key: 'hook',      label: 'HOOK'      },
  { key: 'problem',   label: 'PROBLEM'   },
  { key: 'stakes',    label: 'STAKES'    },
  { key: 'approach',  label: 'APPROACH'  },
  { key: 'demo',      label: 'DEMO'      },
  { key: 'close',     label: 'CLOSE'     },
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
            <Words text="Code is" reduceMotion={reduceMotion} />{' '}
            <Words text="free." className="flame" delay={0.18} reduceMotion={reduceMotion} /><br />
            <Words text="Testing isn't." delay={0.42} reduceMotion={reduceMotion} />
          </h1>
          <p className="pitch__lede">
            <strong>Compound</strong> reads how a brain responds to your website
            — before you ever ship it to one.
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
          Testing it still takes <span className="flame">six weeks.</span>
        </motion.h2>
      </motion.div>

      <div className="pitch__hook-meter">
        <div className="pitch__hook-meter-row">
          <span className="pitch__hook-meter-label">CODE PRODUCED · 2025</span>
          <span className="pitch__hook-meter-bar pitch__hook-meter-bar--fill" />
          <span className="pitch__hook-meter-num">
            <CountUp
              to={4.2}
              duration={1.6}
              format={(n) => `${n.toFixed(1)}B lines`}
            />
          </span>
        </div>
        <div className="pitch__hook-meter-row">
          <span className="pitch__hook-meter-label">USERS WHO TESTED IT</span>
          <span className="pitch__hook-meter-bar pitch__hook-meter-bar--empty" />
          <span className="pitch__hook-meter-num pitch__hook-meter-num--alt">
            <Words text="≈ five strangers" reduceMotion={reduceMotion} delay={0.9} />
          </span>
        </div>
      </div>

      <p className="pitch__kicker">
        AI made shipping free. The bottleneck moved — and nobody refactored for it.
      </p>
    </div>
  )
}

function SlideProblem() {
  return (
    <div className="pitch__slide pitch__slide--problem">
      <Tape><span>FIG. 02</span> THE BOTTLENECK</Tape>

      <h2 className="pitch__heading">
        Building was the bottleneck.<br />
        <span className="flame">Now it's the human.</span>
      </h2>

      <motion.div
        className="pitch__problem-grid"
        variants={STAGGER_PARENT}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={RISE_CHILD} className="pitch__stat">
          <div className="pitch__stat-num">
            n = <CountUp to={5} duration={1.0} />
          </div>
          <div className="pitch__stat-body">
            The "industry standard" user test. Five strangers, one room,
            an hour of think-aloud — used to decide what billions of people see.
          </div>
        </motion.div>
        <motion.div variants={RISE_CHILD} className="pitch__stat">
          <div className="pitch__stat-num">
            <CountUp to={6} duration={1.0} />&nbsp;weeks
          </div>
          <div className="pitch__stat-body">
            Average wait for a moderated study. By the time the report lands,
            you've shipped four times and forgotten the question.
          </div>
        </motion.div>
        <motion.div variants={RISE_CHILD} className="pitch__stat">
          <div className="pitch__stat-num">$0</div>
          <div className="pitch__stat-body">
            What heatmaps cost you and what they tell you. They show
            where eyes <em>went</em> — never how the brain <em>felt.</em>
          </div>
        </motion.div>
      </motion.div>

      <p className="pitch__kicker">
        Every founder, designer, growth lead is shipping on a gut, calling it
        taste, hoping the funnel forgives them. <strong>The funnel is the test.</strong>
      </p>
    </div>
  )
}

function SlideStakes() {
  return (
    <div className="pitch__slide pitch__slide--stakes">
      <Tape><span>FIG. 03</span> WHY IT MATTERS</Tape>

      <h2 className="pitch__heading">
        UX is the largest <span className="flame">unmeasured variable</span><br />
        in the economy.
      </h2>

      <motion.div
        className="pitch__stakes-grid"
        variants={STAGGER_PARENT}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={RISE_CHILD} className="pitch__stake">
          <div className="pitch__stake-num">
            $<CountUp to={5} duration={1.0} />T
          </div>
          <div className="pitch__stake-label">spent online in 2025</div>
          <div className="pitch__stake-body">
            Routed entirely by how a page <em>feels</em> in the first ten seconds.
          </div>
        </motion.div>
        <motion.div variants={RISE_CHILD} className="pitch__stake">
          <div className="pitch__stake-num">
            <CountUp to={88} duration={1.4} />%
          </div>
          <div className="pitch__stake-label">of users won't return</div>
          <div className="pitch__stake-body">
            after one bad experience. The page they bounced from is still up.
          </div>
        </motion.div>
        <motion.div variants={RISE_CHILD} className="pitch__stake">
          <div className="pitch__stake-num">9 / 10</div>
          <div className="pitch__stake-label">UX decisions ship blind</div>
          <div className="pitch__stake-body">
            because evidence is slow, expensive, and arrives too late to matter.
          </div>
        </motion.div>
      </motion.div>

      <div className="pitch__quote">
        <span className="pitch__quote-mark">“</span>
        <p>
          The team that can <strong>predict response</strong> ships better — not
          eventually, but on the first try. Today, nobody can.
        </p>
      </div>
    </div>
  )
}

function SlideApproach() {
  const steps = [
    {
      n: '01',
      title: 'Capture',
      body: <>Paste any URL. We render it in headless Chromium and produce a <strong>10-second scrolling film</strong> — the stimulus.</>,
    },
    {
      n: '02',
      title: 'Encode',
      body: <>Meta's <strong>TRIBE v2</strong> — an fMRI-trained transformer — predicts cortical response across the Destrieux atlas, frame by frame, second by second.</>,
    },
    {
      n: '03',
      title: 'Diagnose',
      body: <>We pair raw scores with our own model trained on <strong>30 production SaaS sites</strong>. Out comes a per-second anomaly trace. Claude reads it like a user-research director.</>,
    },
    {
      n: '04',
      title: 'Rewrite',
      body: <>Claude points at the broken second, we extract the frame, edit the live HTML, and <strong>pre-render v2</strong> back into the UI with a redesign and a predicted uplift.</>,
    },
  ]
  return (
    <div className="pitch__slide pitch__slide--approach">
      <Tape><span>FIG. 04</span> A NEW APPROACH</Tape>

      <h2 className="pitch__heading">
        Not heatmaps. Not panels.<br />
        We <span className="flame">read the page</span> like a viewer would.
      </h2>

      <motion.div
        className="pitch__plates"
        variants={STAGGER_PARENT}
        initial="initial"
        animate="animate"
      >
        {steps.map((s) => (
          <motion.div
            key={s.n}
            variants={RISE_CHILD}
            className="pitch__plate"
          >
            <span className="pitch__plate-num">{s.n}</span>
            <h3 className="pitch__plate-title">{s.title}</h3>
            <p className="pitch__plate-body">{s.body}</p>
          </motion.div>
        ))}
      </motion.div>

      <p className="pitch__kicker">
        Closed loop · URL in, redesigned page out — in roughly the time it takes
        to make a coffee.
      </p>
    </div>
  )
}

function SlideDemo() {
  return (
    <div className="pitch__slide pitch__slide--demo">
      <Tape><span>FIG. 05</span> DEMO · LIVE</Tape>

      <h2 className="pitch__heading">
        Second four of your hero<br />
        is <span className="flame">where attention dies.</span>
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
          Hero CTA shrunk below visual weight at 0:04 — re-stage.
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
      <Tape><span>FIG. 06</span> CLOSE</Tape>

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
  cover:    SlideCover,
  hook:     SlideHook,
  problem:  SlideProblem,
  stakes:   SlideStakes,
  approach: SlideApproach,
  demo:     SlideDemo,
  close:    SlideClose,
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
            className="pitch__slide-wrap"
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
