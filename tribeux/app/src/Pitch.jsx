import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE_OUT_QUINT } from './motion'

/* ------------------------------------------------------------------ */
/*  Slide content                                                       */
/* ------------------------------------------------------------------ */

const SLIDES = [
  { key: 'cover',    label: 'PITCH'    },
  { key: 'problem',  label: 'PROBLEM'  },
  { key: 'stakes',   label: 'STAKES'   },
  { key: 'approach', label: 'APPROACH' },
  { key: 'demo',     label: 'DEMO'     },
  { key: 'whynow',   label: 'WHY NOW'  },
  { key: 'close',    label: 'CLOSE'    },
]

const TOTAL = SLIDES.length

const SLIDE_VARIANTS = {
  initial: (dir) => ({ opacity: 0, x: 24 * dir, filter: 'blur(8px)' }),
  animate: { opacity: 1, x: 0,           filter: 'blur(0px)'  },
  exit:    (dir) => ({ opacity: 0, x: -24 * dir, filter: 'blur(8px)' }),
}

const SLIDE_TRANSITION = { duration: 0.42, ease: EASE_OUT_QUINT }

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

/* ------------------------------------------------------------------ */
/*  Slides                                                              */
/* ------------------------------------------------------------------ */

function SlideCover() {
  return (
    <div className="pitch__slide pitch__slide--cover">
      <div className="pitch__cover-grid">
        <div>
          <Tape><span>FIG. 00</span> PITCH · 3 MIN</Tape>
          <h1 className="pitch__title">
            User <span className="flame">data.</span><br />
            <span className="pitch__title-strike">Without users.</span>
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
          <img
            src="/sticker-browser-brain.png"
            alt="Halftone sticker — a browser window wrapped in a brain on fire."
            className="pitch__cover-sticker"
          />
          <div className="pitch__cover-pow"><Starburst label="POW" /></div>
        </figure>
      </div>
    </div>
  )
}

function SlideProblem() {
  return (
    <div className="pitch__slide pitch__slide--problem">
      <Tape><span>FIG. 01</span> THE PROBLEM</Tape>

      <h2 className="pitch__heading">
        Every page on the internet<br />
        was designed in <span className="flame">the dark.</span>
      </h2>

      <div className="pitch__problem-grid">
        <div className="pitch__stat">
          <div className="pitch__stat-num">n = 5</div>
          <div className="pitch__stat-body">
            The "industry standard" user test. Five strangers, one room,
            an hour of think-aloud — used to decide what billions of people see.
          </div>
        </div>
        <div className="pitch__stat">
          <div className="pitch__stat-num">6&nbsp;weeks</div>
          <div className="pitch__stat-body">
            Average wait for a moderated study. By the time the report lands,
            you've shipped four times and forgotten the question.
          </div>
        </div>
        <div className="pitch__stat">
          <div className="pitch__stat-num">$0</div>
          <div className="pitch__stat-body">
            What heatmaps cost you and what they tell you. They show
            where eyes <em>went</em> — never how the brain <em>felt.</em>
          </div>
        </div>
      </div>

      <p className="pitch__kicker">
        Every founder, designer, growth lead — shipping on a gut, calling it
        taste, hoping the funnel forgives them.
      </p>
    </div>
  )
}

function SlideStakes() {
  return (
    <div className="pitch__slide pitch__slide--stakes">
      <Tape><span>FIG. 02</span> WHY IT MATTERS</Tape>

      <h2 className="pitch__heading">
        UX is the largest <span className="flame">unmeasured variable</span><br />
        in the economy.
      </h2>

      <div className="pitch__stakes-grid">
        <div className="pitch__stake">
          <div className="pitch__stake-num">$5T</div>
          <div className="pitch__stake-label">spent online in 2025</div>
          <div className="pitch__stake-body">
            Routed entirely by how a page <em>feels</em> in the first ten seconds.
          </div>
        </div>
        <div className="pitch__stake">
          <div className="pitch__stake-num">88%</div>
          <div className="pitch__stake-label">of users won't return</div>
          <div className="pitch__stake-body">
            after one bad experience. The page they bounced from is still up.
          </div>
        </div>
        <div className="pitch__stake">
          <div className="pitch__stake-num">9 / 10</div>
          <div className="pitch__stake-label">UX decisions ship blind</div>
          <div className="pitch__stake-body">
            because evidence is slow, expensive, and arrives too late to matter.
          </div>
        </div>
      </div>

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
      <Tape><span>FIG. 03</span> A NEW APPROACH</Tape>

      <h2 className="pitch__heading">
        Not heatmaps. Not panels.<br />
        We <span className="flame">read the page</span> like a viewer would.
      </h2>

      <div className="pitch__plates">
        {steps.map((s) => (
          <div key={s.n} className="pitch__plate" style={{ '--plate-i': s.n }}>
            <span className="pitch__plate-num">{s.n}</span>
            <h3 className="pitch__plate-title">{s.title}</h3>
            <p className="pitch__plate-body">{s.body}</p>
          </div>
        ))}
      </div>

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
      <Tape><span>FIG. 04</span> DEMO · LIVE</Tape>

      <h2 className="pitch__heading">
        Second four of your hero<br />
        is <span className="flame">where attention dies.</span>
      </h2>

      <div className="pitch__demo-stage">
        <figure className="pitch__demo-frame pitch__demo-frame--before">
          <figcaption>BEFORE · v1</figcaption>
          <img src="/airbnb-landing.png" alt="The original homepage frame at second 04." />
          <span className="pitch__demo-stamp pitch__demo-stamp--bad">REWARD ↓ 38%</span>
        </figure>

        <div className="pitch__demo-pipe">
          <div className="pitch__demo-pipe-line" />
          <div className="pitch__demo-pipe-row">
            <span className="pitch__demo-pipe-step">URL</span>
            <span>›</span>
            <span className="pitch__demo-pipe-step">VIDEO</span>
            <span>›</span>
            <span className="pitch__demo-pipe-step pitch__demo-pipe-step--accent">TRIBE v2</span>
            <span>›</span>
            <span className="pitch__demo-pipe-step">CLAUDE</span>
            <span>›</span>
            <span className="pitch__demo-pipe-step">v2</span>
          </div>
          <div className="pitch__demo-pipe-meta">~ 90 seconds, end to end</div>
        </div>

        <figure className="pitch__demo-frame pitch__demo-frame--after">
          <figcaption>AFTER · v2</figcaption>
          <img src="/airbnb-landing.png" alt="The redesigned homepage frame at second 04." />
          <span className="pitch__demo-stamp pitch__demo-stamp--good">REWARD ↑ +14%</span>
        </figure>
      </div>

      <ul className="pitch__demo-recs">
        <li><span className="pitch__demo-tick">·</span>Hero CTA shrunk below visual weight at 0:04 — re-stage.</li>
        <li><span className="pitch__demo-tick">·</span>Affective valence dips on second card — replace stock photo.</li>
        <li><span className="pitch__demo-tick">·</span>Footer dominates surprise score — cut by 40%.</li>
      </ul>
    </div>
  )
}

function SlideWhyNow() {
  return (
    <div className="pitch__slide pitch__slide--whynow">
      <Tape><span>FIG. 05</span> WHY NOW</Tape>

      <h2 className="pitch__heading">
        This stack didn't exist<br />
        <span className="flame">six months ago.</span>
      </h2>

      <div className="pitch__why-grid">
        <div className="pitch__why-card">
          <div className="pitch__why-tag">RESEARCH</div>
          <h3>TRIBE v2 just shipped.</h3>
          <p>
            Meta released an fMRI-trained transformer that predicts brain
            response from arbitrary video. Two years ago, this was a paper.
            Today, it's an HTTP endpoint.
          </p>
        </div>
        <div className="pitch__why-card">
          <div className="pitch__why-tag">PROPRIETARY</div>
          <h3>We taught it to read websites.</h3>
          <p>
            Raw cortical scores aren't useful. We trained our own anomaly
            model on <strong>30 production SaaS</strong> homepages — so the
            signal becomes "this section is broken."
          </p>
        </div>
        <div className="pitch__why-card">
          <div className="pitch__why-tag">ORCHESTRATION</div>
          <h3>Claude closes the loop.</h3>
          <p>
            Per-second anomalies → frame extraction → live HTML edit →
            re-rendered v2 video. The first time a model gets to fix what it
            diagnoses, end to end.
          </p>
        </div>
      </div>

      <p className="pitch__kicker pitch__kicker--mono">
        BUILT IN 24 HOURS · APPLE ML INTERN · IMPERIAL CS · 3× HACKATHON WINNER
      </p>
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
        Predicted user response, before users ever see the page. The way new
        teams design websites — as soon as we get out of this room.
      </p>

      <div className="pitch__close-pill">
        <span className="pitch__close-pill-num">URL ▸</span>
        <span className="pitch__close-pill-input">your-website.com</span>
        <span className="pitch__close-pill-cta">SCAN</span>
      </div>

      <div className="pitch__close-foot">
        <span>compound.app</span>
        <span>· · ·</span>
        <span>thank you, judges.</span>
      </div>

      <div className="pitch__close-pow"><Starburst label="GO" color="flame" /></div>
    </div>
  )
}

const SLIDE_COMPONENTS = {
  cover:    SlideCover,
  problem:  SlideProblem,
  stakes:   SlideStakes,
  approach: SlideApproach,
  demo:     SlideDemo,
  whynow:   SlideWhyNow,
  close:    SlideClose,
}

/* ------------------------------------------------------------------ */
/*  Container                                                           */
/* ------------------------------------------------------------------ */

export default function Pitch() {
  const [{ idx, dir }, setState] = useState({ idx: 0, dir: 1 })
  const idxRef = useRef(0)

  useEffect(() => {
    idxRef.current = idx
  }, [idx])

  const goTo = useCallback((target) => {
    setState((prev) => {
      const clamped = Math.max(0, Math.min(TOTAL - 1, target))
      if (clamped === prev.idx) return prev
      return { idx: clamped, dir: clamped > prev.idx ? 1 : -1 }
    })
  }, [])

  const goNext = useCallback(() => goTo(idxRef.current + 1), [goTo])
  const goPrev = useCallback(() => goTo(idxRef.current - 1), [goTo])

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
    <section className="pitch">
      <div className="pitch__rule" aria-hidden="true" />
      <div className="pitch__stage">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={current.key}
            className="pitch__slide-shell"
            custom={dir}
            variants={SLIDE_VARIANTS}
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
          <span className="pitch__counter-num">
            {String(idx + 1).padStart(2, '0')}
          </span>
          <span className="pitch__counter-sep">/</span>
          <span className="pitch__counter-tot">
            {String(TOTAL).padStart(2, '0')}
          </span>
          <span className="pitch__counter-label">{current.label}</span>
        </div>

        <div className="pitch__dots" role="tablist" aria-label="Slides">
          {SLIDES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`Slide ${i + 1}: ${s.label}`}
              className={`pitch__dot${i === idx ? ' is-active' : ''}`}
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
    </section>
  )
}
