import { NavLink } from 'react-router-dom'
import { isMockEnabled } from './lib/mockApi'

export function Masthead() {
  const mock = isMockEnabled()
  return (
    <header className="masthead">
      <div className="masthead__word" aria-label="Compound">
        Comp<em>ound</em>
      </div>
      {mock && (
        <button
          type="button"
          className="masthead__mock"
          title="Frontend-only mock data (?mock=1). Click to disable."
          onClick={() => {
            try { window.localStorage.removeItem('compound_mock') } catch { /* ignore */ }
            const u = new URL(window.location.href)
            u.searchParams.delete('mock')
            window.location.replace(u.toString())
          }}
        >
          <span className="masthead__mock__dot" aria-hidden="true" />
          MOCK DATA
        </button>
      )}
      <nav className="masthead__nav" aria-label="Primary">
        <NavLink to="/"       end className={({isActive}) => isActive ? 'is-active' : ''}>Home</NavLink>
        <NavLink to="/demo"      className={({isActive}) => isActive ? 'is-active' : ''}>Scan</NavLink>
        <NavLink to="/report"    className={({isActive}) => isActive ? 'is-active' : ''}>Findings</NavLink>
      </nav>
    </header>
  )
}

export function Colophon() {
  return (
    <footer className="colophon">
      <span>Compound · hackathon build · 2026</span>
      <span>TRIBE v2 (Meta, CC BY-NC) · non-clinical</span>
    </footer>
  )
}
