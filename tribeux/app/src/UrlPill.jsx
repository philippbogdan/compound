import { useState, useRef, useLayoutEffect } from 'react'

const IDLE_WIDTH = 260
const MAX_WIDTH = 640
const PADDING_LEFT = 22
const PADDING_RIGHT = 60
const MEASURE_BUFFER = 4

const SURFACE_MS = 200
const CLIP_GROW_MS = 400
const SHRINK_MS = 200

export default function UrlPill({ value, onChange, onSubmit, autoFocus = true, disabled = false }) {
  const [pillWidth, setPillWidth] = useState(IDLE_WIDTH)
  const [clipMs, setClipMs] = useState(CLIP_GROW_MS)
  const prevWidthRef = useRef(IDLE_WIDTH)
  const measureRef = useRef(null)

  useLayoutEffect(() => {
    if (!measureRef.current) return
    const measured = measureRef.current.getBoundingClientRect().width
    const desired = measured + PADDING_LEFT + PADDING_RIGHT + MEASURE_BUFFER
    const next = Math.min(Math.max(desired, IDLE_WIDTH), MAX_WIDTH)
    const prev = prevWidthRef.current
    if (next === prev) return
    setClipMs(next > prev ? CLIP_GROW_MS : SHRINK_MS)
    setPillWidth(next)
    prevWidthRef.current = next
  }, [value])

  const handleKeyDown = e => {
    if (e.key === 'Enter' && value.trim() && !disabled) onSubmit?.(value)
  }

  return (
    <>
      <div
        className="pill-surface"
        style={{ width: pillWidth, transitionDuration: `${SURFACE_MS}ms` }}
        aria-hidden="true"
      />
      <div
        className="pill-clip"
        style={{ width: pillWidth, transitionDuration: `${clipMs}ms` }}
      >
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="your-website.com"
          spellCheck={false}
          autoFocus={autoFocus}
          disabled={disabled}
          className="url-input"
        />
      </div>
      <div
        className="pill-actions"
        style={{ width: pillWidth, transitionDuration: `${SURFACE_MS}ms` }}
      >
        <button
          type="button"
          aria-label="Analyze"
          className="send-btn"
          onClick={() => value.trim() && !disabled && onSubmit?.(value)}
          disabled={disabled}
        >
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="15" fill="#1A1A1A"/>
            <path d="
              M 16 9
              Q 16.9 9 17.55 9.65
              L 22 14.1
              Q 23 15.1 22 16.1
              Q 21 17.1 20 16.1
              L 18.4 14.5
              Q 17.6 13.7 17.6 14.8
              L 17.6 23
              Q 17.6 24.5 16 24.5
              Q 14.4 24.5 14.4 23
              L 14.4 14.8
              Q 14.4 13.7 13.6 14.5
              L 12 16.1
              Q 11 17.1 10 16.1
              Q 9 15.1 10 14.1
              L 14.45 9.65
              Q 15.1 9 16 9
              Z"
              fill="#FFFFFF"/>
          </svg>
        </button>
      </div>
      <span ref={measureRef} className="url-measure" aria-hidden="true">
        {value}
      </span>
    </>
  )
}
