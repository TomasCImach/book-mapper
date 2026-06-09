import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {
  initializeAnalytics,
  initializeLinkTracking,
  trackPageContext,
} from './lib/analytics'
import { classifyPageRoute, isMapCapableRoute } from './lib/pageRoutes'

initializeAnalytics()
initializeLinkTracking()

const appRoot = document.getElementById('app-root')
const pageRoute = classifyPageRoute(window.location.pathname)
const shouldRenderInteractiveApp = appRoot && isMapCapableRoute(pageRoute)

trackPageContext(pageRoute)

if (shouldRenderInteractiveApp) {
  createRoot(appRoot).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
