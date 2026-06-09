import { useEffect } from 'react'
import { BookMapScene } from './components/BookMapScene'
import { MapControls } from './components/MapControls'
import { resolveDeepLinkSelection } from './lib/deepLinks'
import { useMapStore } from './store/mapStore'
import './App.css'

function App() {
  useEffect(() => {
    const selection = resolveDeepLinkSelection()

    if (!selection) {
      return
    }

    useMapStore.getState().setSelectedBookId(selection.bookId)

    if (typeof selection.chapter === 'number') {
      useMapStore.getState().setSelectedChapter(selection.chapter)
    }
  }, [])

  return (
    <main className="book-map-app">
      <BookMapScene />
      <MapControls />
    </main>
  )
}

export default App
