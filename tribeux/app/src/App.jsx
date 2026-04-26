import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Landing from './Landing'
import Demo from './Demo'
import Report from './Report'
import Pitch from './Pitch'
import { Masthead, Colophon } from './Shell'
import './App.css'

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/"       element={<Landing />} />
        <Route path="/demo"   element={<Demo />} />
        <Route path="/report" element={<Report />} />
        <Route path="/pitch"  element={<Pitch />} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="shell">
        <Masthead />
        <main>
          <AnimatedRoutes />
        </main>
        <Colophon />
      </div>
    </BrowserRouter>
  )
}
