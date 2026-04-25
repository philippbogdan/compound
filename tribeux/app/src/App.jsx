import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import UrlPill from './UrlPill'
import Demo from './Demo'
import './App.css'

function Landing() {
  const [url, setUrl] = useState('')
  return (
    <main className="page">
      <UrlPill value={url} onChange={setUrl} onSubmit={() => {}} />
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/demo" element={<Demo />} />
      </Routes>
    </BrowserRouter>
  )
}
