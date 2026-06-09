import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { classifyPageRoute, isMapCapableRoute } from './lib/pageRoutes'

const appRoot = document.getElementById('app-root')
const shouldRenderInteractiveApp =
  appRoot && isMapCapableRoute(classifyPageRoute(window.location.pathname))

if (shouldRenderInteractiveApp) {
  createRoot(appRoot).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
