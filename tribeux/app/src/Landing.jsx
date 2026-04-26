import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import UrlPill from './UrlPill'
import ScanHandoff from './ScanHandoff'
import { PAGE_VARIANTS, PAGE_TRANSITION } from './motion'

const BENCHMARK_SITES = [
  'airbnb', 'stripe', 'linear', 'nytimes', 'apple',
  'notion', 'figma', 'substack', 'duolingo', 'github',
  'vercel', 'supabase', 'arc', 'pitchfork', 'anthropic',
  'perplexity', 'are.na', 'shopify', 'patagonia', 'spotify',
]

function Starburst({ label = 'NEW', className = '' }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <polygon
        points="60,4 70,32 96,18 88,48 118,52 94,70 116,92 86,88 94,118 66,100 60,120 54,100 26,118 34,88 4,92 26,70 2,52 32,48 24,18 50,32"
        fill="oklch(0.87 0.17 95)"
        stroke="oklch(0.16 0.010 260)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <text
        x="60" y="66"
        textAnchor="middle"
        fontFamily="'Bricolage Grotesque', sans-serif"
        fontWeight="800"
        fontSize="22"
        fill="oklch(0.16 0.010 260)"
        style={{ letterSpacing: '-0.02em' }}
      >{label}</text>
    </svg>
  )
}

export default function Landing() {
  const [url, setUrl] = useState('')
  const [scanning, setScanning] = useState(false)
  const [target, setTarget] = useState('')
  const nav = useNavigate()

  const go = v => {
    const t = (v || url).trim()
    if (!t || scanning) return
    setTarget(t)
    setScanning(true)
  }

  const finish = useCallback(() => {
    nav(`/demo?url=${encodeURIComponent(target)}`)
  }, [nav, target])

  return (
    <>
      <motion.section
        className={`landing${scanning ? ' is-scanning' : ''}`}
        variants={PAGE_VARIANTS}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={PAGE_TRANSITION}
      >
      <div className="landing__grid">
        <div>
          <div className="landing__tape">
            <span>FIG. 01</span>
            NEURAL RESPONSE, PREDICTED
          </div>

          <h2 className="landing__title">
            User <span className="flame">data</span><br />
            without users.
          </h2>

          <p className="landing__lede">
            Paste a URL. We render it, feed the film to a brain encoder, and
            return cortical-response data that would otherwise take a panel of{' '}
            <strong>30 participants</strong>. Claude reads the anomalies and
            tells you what to fix.
          </p>

          <div className="landing__pill-wrap">
            <span className="landing__pill-number">URL ▸</span>
            <UrlPill
              value={url}
              onChange={setUrl}
              onSubmit={go}
              disabled={scanning}
              variant="inline"
            />
          </div>

          <p className="landing__fig-caption">
            <strong>Enter</strong>
            <span>· any public URL · scan takes about 45s · free for the demo</span>
          </p>
        </div>

        <figure className="landing__figure">
          <img
            src="/sticker-browser-brain.png"
            alt="Halftone sticker — a browser window wrapped in a brain on fire, encircled by arrows"
            className="landing__sticker"
          />
          <div className="landing__figure__pow">
            <Starburst label="POW" />
          </div>
        </figure>
      </div>

      <div className="landing__plates" id="method">
        <div className="plate" style={{ '--plate-i': 0 }}>
          <span className="plate__num" />
          <h3 className="plate__title">Render</h3>
          <p className="plate__body">
            Playwright drives a headless Chromium and records a 256×256 scrolling
            film. That's the stimulus.
          </p>
        </div>
        <div className="plate" style={{ '--plate-i': 1 }}>
          <span className="plate__num" />
          <h3 className="plate__title">Infer</h3>
          <p className="plate__body">
            TRIBE v2, Meta's fMRI-trained transformer, predicts cortical response
            across the Destrieux atlas, frame by frame.
          </p>
        </div>
        <div className="plate" style={{ '--plate-i': 2 }}>
          <span className="plate__num" />
          <h3 className="plate__title">Compare</h3>
          <p className="plate__body">
            Five affective axes projected from the response. Z-scored against a
            corpus of 30 homepages.
          </p>
        </div>
        <div className="plate" style={{ '--plate-i': 3 }}>
          <span className="plate__num" />
          <h3 className="plate__title">Interpret</h3>
          <p className="plate__body">
            Claude reads the anomalies, picks the frames that matter, and
            recommends a redesign with predicted uplift.
          </p>
        </div>
      </div>

      <div className="ticker" aria-hidden="true">
        <div className="ticker__track">
          {[...BENCHMARK_SITES, ...BENCHMARK_SITES].map((s, i) => (
            <span key={i}>{s}</span>
          ))}
        </div>
      </div>
      </motion.section>
      {/* Sibling of motion.section so position:fixed isn't trapped by the
          page-transition transform on the section. */}
      <AnimatePresence>
        {scanning && (
          <ScanHandoff key="scan-handoff" url={target} onComplete={finish} />
        )}
      </AnimatePresence>
    </>
  )
}
