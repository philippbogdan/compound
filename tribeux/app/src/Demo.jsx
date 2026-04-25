import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import UrlPill from './UrlPill'
import './App.css'

// Pipeline stages — each advances only when its real work completes.
// Keep this list linear and explicit so adding/removing a stage is a single edit.
const STAGES = [
  'input',        // user types URL
  'scrolling',    // scroll-capture the site into a video
  'inference',    // run TRIBE v2 on the video
  'emotion',      // map brain activity into emotion space
  'scoring',      // score sections by performance
  'insights',     // LLM produces critique
  'variants',     // GPT Image 2 generates modified screenshots
  'rescore',      // re-run pipeline on variants
  'diff',         // final delta = the recommended changes
]

const EASE = [0.22, 1, 0.36, 1]

export default function Demo() {
  const [url, setUrl] = useState('')
  const [stage, setStage] = useState('input')

  const advance = useCallback(next => setStage(next), [])

  const handleSubmit = useCallback(() => {
    advance('scrolling')
  }, [advance])

  return (
    <main className="page demo-page">
      <AnimatePresence mode="wait">
        {stage === 'input' && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24, transition: { duration: 0.4, ease: EASE } }}
            transition={{ duration: 0.45, ease: EASE }}
            className="stage-input"
          >
            <UrlPill
              value={url}
              onChange={setUrl}
              onSubmit={handleSubmit}
            />
          </motion.div>
        )}

        {stage !== 'input' && (
          <motion.div
            key="pipeline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.2 }}
            className="stage-pipeline"
          >
            <p className="stage-label">Stage: {stage}</p>
            <p className="stage-hint">Running on {url || '—'}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
