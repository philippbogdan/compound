import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { EASE_OUT_QUINT } from './motion'

// The total beat from "user pressed enter" to "we navigate to /demo."
// Tweak only here — every CSS animation-delay in App.css is keyed to this.
export const SCAN_HANDOFF_MS = 3400

// A small deterministic block layout for the faux site scaffold so that the
// "scanned site" reads as a website without resembling any specific brand.
const SCAFFOLD_BLOCKS = [
  // [top%, left%, width%, height%, kind]
  [4,  6, 18,  4, 'meta'],
  [4, 78, 16,  4, 'meta'],
  [16, 6, 56, 12, 'h1'],
  [32, 6, 38,  6, 'lede'],
  [42, 6, 28,  4, 'lede'],
  [54, 6, 22,  6, 'cta'],
  [64, 6, 88, 22, 'image'],
  [90, 6, 30,  3, 'foot'],
  [90, 76, 18, 3, 'foot'],
]

export default function ScanHandoff({ url, onComplete }) {
  useEffect(() => {
    const t = setTimeout(onComplete, SCAN_HANDOFF_MS)
    return () => clearTimeout(t)
  }, [onComplete])

  // Strip protocol off the URL the user typed; we render the scheme separately.
  const display = useMemo(() => {
    return (url || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
  }, [url])

  return (
    <motion.div
      className="scan-handoff"
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: EASE_OUT_QUINT }}
    >
      <div className="scan-handoff__stage">
        <div className="scan-handoff__chrome">
          <span className="scan-handoff__lights" aria-hidden="true">
            <em /><em /><em />
          </span>
          <div className="scan-handoff__address">
            <span className="scan-handoff__scheme">https://</span>
            <span className="scan-handoff__url">{display}</span>
            <span className="scan-handoff__caret" aria-hidden="true" />
          </div>
          <span className="scan-handoff__step">FIG. 00 · STIMULUS LOAD</span>
        </div>

        <div className="scan-handoff__canvas">
          <div className="scan-handoff__scaffold" aria-hidden="true">
            {SCAFFOLD_BLOCKS.map(([t, l, w, h, kind], i) => (
              <span
                key={i}
                className={`scan-handoff__block scan-handoff__block--${kind}`}
                style={{
                  top: `${t}%`,
                  left: `${l}%`,
                  width: `${w}%`,
                  height: `${h}%`,
                  '--block-i': i,
                }}
              />
            ))}
          </div>
          <div className="scan-handoff__halftone" aria-hidden="true" />
          <div className="scan-handoff__scanline" aria-hidden="true" />
          <div className="scan-handoff__flash" aria-hidden="true" />
          <div className="scan-handoff__tape">
            <span>✓ STIMULUS LOCKED</span>
          </div>
        </div>

        <div className="scan-handoff__readout">
          <span>RENDERING · 256×256 · 4.8 s · 24 fps</span>
          <span>HANDOFF → TRIBE V2</span>
        </div>
      </div>
    </motion.div>
  )
}
