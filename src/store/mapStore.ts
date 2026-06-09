import { create } from 'zustand'
import {
  DEFAULT_BOOK_ID,
  getBookModel,
  getFirstMappedChapter,
  type BookModel,
  type RouteSegment,
} from '../data/journey'

type MapState = {
  selectedBookId: string
  selectedChapter: number
  selectedSegmentId: string
  isPlaying: boolean
  depthExaggerated: boolean
  setSelectedBookId: (bookId: string) => void
  setSelectedChapter: (chapter: number) => void
  setSelectedSegmentId: (segmentId: string) => void
  setIsPlaying: (isPlaying: boolean) => void
  toggleDepthExaggeration: () => void
  previousChapter: () => void
  nextChapter: () => void
  reset: () => void
}

const initialBookModel = getBookModel(DEFAULT_BOOK_ID)
const initialMappedChapter = getFirstMappedChapter(initialBookModel)

function clampChapter(chapter: number, model: BookModel) {
  const minChapter = model.chapters[0].number
  const maxChapter = model.chapters[model.chapters.length - 1].number

  return Math.min(maxChapter, Math.max(minChapter, chapter))
}

function lastVisibleSegmentId(chapter: number, segments: RouteSegment[]) {
  return (
    segments.findLast((segment) => segment.chapterStart <= chapter)?.id ??
    segments[0]?.id ??
    ''
  )
}

export const useMapStore = create<MapState>((set, get) => ({
  selectedBookId: DEFAULT_BOOK_ID,
  selectedChapter: initialMappedChapter,
  selectedSegmentId: lastVisibleSegmentId(
    initialMappedChapter,
    initialBookModel.routeSegments,
  ),
  isPlaying: false,
  depthExaggerated: true,
  setSelectedBookId: (selectedBookId) => {
    const model = getBookModel(selectedBookId)
    const selectedChapter = getFirstMappedChapter(model)

    set({
      selectedBookId: model.book.id,
      selectedChapter,
      selectedSegmentId: lastVisibleSegmentId(selectedChapter, model.routeSegments),
      isPlaying: false,
    })
  },
  setSelectedChapter: (chapter) => {
    const model = getBookModel(get().selectedBookId)
    const maxChapter = model.chapters[model.chapters.length - 1].number
    const nextChapter = clampChapter(chapter, model)
    set({
      selectedChapter: nextChapter,
      selectedSegmentId: lastVisibleSegmentId(nextChapter, model.routeSegments),
      isPlaying: nextChapter === maxChapter ? false : get().isPlaying,
    })
  },
  setSelectedSegmentId: (selectedSegmentId) => set({ selectedSegmentId }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  toggleDepthExaggeration: () =>
    set((state) => ({ depthExaggerated: !state.depthExaggerated })),
  previousChapter: () => {
    const model = getBookModel(get().selectedBookId)
    const selectedChapter = clampChapter(get().selectedChapter - 1, model)
    set({
      selectedChapter,
      selectedSegmentId: lastVisibleSegmentId(selectedChapter, model.routeSegments),
    })
  },
  nextChapter: () => {
    const model = getBookModel(get().selectedBookId)
    const maxChapter = model.chapters[model.chapters.length - 1].number
    const selectedChapter = clampChapter(get().selectedChapter + 1, model)
    set({
      selectedChapter,
      selectedSegmentId: lastVisibleSegmentId(selectedChapter, model.routeSegments),
      isPlaying: selectedChapter === maxChapter ? false : get().isPlaying,
    })
  },
  reset: () => {
    const model = getBookModel(get().selectedBookId)
    const selectedChapter = getFirstMappedChapter(model)

    set({
      selectedChapter,
      selectedSegmentId: lastVisibleSegmentId(selectedChapter, model.routeSegments),
      isPlaying: false,
      depthExaggerated: true,
    })
  },
}))
