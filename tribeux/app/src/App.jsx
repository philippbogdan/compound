import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './Landing'
import Demo from './Demo'
import Report from './Report'
import { Masthead, Colophon } from './Shell'
import './App.css'

function Shell({ children }) {
  return (
    <div className="shell">
      <Masthead />
      <main>{children}</main>
      <Colophon />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"       element={<Shell><Landing /></Shell>} />
        <Route path="/demo"   element={<Shell><Demo /></Shell>} />
        <Route path="/report" element={<Shell><Report /></Shell>} />
      </Routes>
    </BrowserRouter>
  )
}
