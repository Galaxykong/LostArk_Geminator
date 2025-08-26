import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    {/* Floating support button — replace the href with your donation link (e.g., https://toss.me/yourid or https://buymeacoffee.com/yourid) */}
    <a
      href="#"
      target="_blank"
      rel="noreferrer"
      className="support-btn inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-4 py-2 shadow hover:bg-emerald-700"
    >
      <span>💚 후원하기</span>
    </a>
  </React.StrictMode>,
)
