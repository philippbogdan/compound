import { useRef } from 'react'

export default function UrlPill({
  value,
  onChange,
  onSubmit,
  autoFocus = true,
  disabled = false,
  variant = 'inline',
}) {
  const inputRef = useRef(null)

  const handleKeyDown = e => {
    if (e.key === 'Enter' && value.trim() && !disabled) onSubmit?.(value)
  }

  const submit = () => {
    if (value.trim() && !disabled) onSubmit?.(value)
  }

  return (
    <div className={`pill-${variant}`}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="paste a URL — airbnb.com"
        spellCheck={false}
        autoFocus={autoFocus}
        disabled={disabled}
        className="url-input"
        aria-label="Website URL to analyse"
      />
      <button
        type="button"
        aria-label="Analyse"
        className="send-btn"
        onClick={submit}
        disabled={disabled}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 12h14M13 6l7 6-7 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}
