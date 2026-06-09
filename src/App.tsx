import { useEffect } from 'react'
import { BookMapScene } from './components/BookMapScene'
import { MapControls } from './components/MapControls'
import { RouteContextPanel } from './components/RouteContextPanel'
import { resolveDeepLinkSelection } from './lib/deepLinks'
import { useMapStore } from './store/mapStore'
import './App.css'

function App() {
  useEffect(() => {
    document.documentElement.classList.add('interactive-app-mounted')

    const selection = resolveDeepLinkSelection()

    if (!selection) {
      return () => {
        document.documentElement.classList.remove('interactive-app-mounted')
      }
    }

    useMapStore.getState().setSelectedBookId(selection.bookId)

    if (typeof selection.chapter === 'number') {
      useMapStore.getState().setSelectedChapter(selection.chapter)
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
