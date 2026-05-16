import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

const isStandalone = !!(window as any).__WIKI_DATA__ || window.location.protocol === 'file:';
const Router = isStandalone ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>,
)
