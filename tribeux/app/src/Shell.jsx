import { NavLink } from 'react-router-dom'

export function Masthead() {
  return (
    <header className="masthead">
      <div className="masthead__word" aria-label="Compound">
        Comp<em>ound</em>
      </div>
      <div className="masthead__status" aria-live="polite">
        Cortex online
      </div>
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
