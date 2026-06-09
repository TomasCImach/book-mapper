import { useEffect } from 'react'
import { BookMapScene } from './components/BookMapScene'
import { MapControls } from './components/MapControls'
import { RouteContextPanel } from './components/RouteContextPanel'
import { getRouteAnalyticsProperties, trackEvent } from './lib/analytics'
import { resolveDeepLinkSelection } from './lib/deepLinks'
import { classifyPageRoute } from './lib/pageRoutes'
import { useMapStore } from './store/mapStore'
import './App.css'

let initialMapViewTracked = false

function App() {
  useEffect(() => {
    document.documentElement.classList.add('interactive-app-mounted')

    const route = classifyPageRoute(window.location.pathname)
    const selection = resolveDeepLinkSelection()

    if (selection) {
      useMapStore.getState().setSelectedBookId(selection.bookId)

      if (typeof selection.chapter === 'number') {
        useMapStore.getState().setSelectedChapter(selection.chapter)
      }
    }

    if (!initialMapViewTracked) {
      const state = useMapStore.getState()
      initialMapViewTracked = true

      trackEvent('map_viewed', {
        ...getRouteAnalyticsProperties(route),
        book_id: state.selectedBookId,
        chapter_number: state.selectedChapter,
        has_deep_link: Boolean(selection),
      })
    }

    return () => {
      document.documentElement.classList.remove('interactive-app-mounted')
    }
  }, [])

  return (
    <main className="book-map-app">
      <BookMapScene />
      <MapControls />
      <RouteContextPanel />
    </main>
  )
}

export default App
