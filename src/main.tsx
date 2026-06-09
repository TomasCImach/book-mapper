import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const appRoot = document.getElementById('app-root')
const params = new URLSearchParams(window.location.search)
const shouldRenderInteractiveApp =
  appRoot && (!appRoot.dataset.staticSeoPage || params.get('view') === 'map')

if (shouldRenderInteractiveApp) {
  createRoot(appRoot).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
