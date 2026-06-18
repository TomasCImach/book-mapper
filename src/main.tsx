import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeAdsenseAutoAds } from './lib/adsense'
import {
  initializeAnalytics,
  initializeLinkTracking,
  trackPageContext,
} from './lib/analytics'
import { classifyPageRoute, isMapCapableRoute } from './lib/pageRoutes'

initializeAdsenseAutoAds()
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
