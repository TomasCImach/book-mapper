import { availableBooks, bookModels, getBookModel } from '../data/journey'
import { classifyPageRoute } from './pageRoutes'

export type DeepLinkSelection = {
  bookId: string
  chapter?: number
}

function getLastChapter(bookId: string) {
  const model = getBookModel(bookId)

  return model.chapters.at(-1)?.number
}

function resolveLocationSelection(locationId: string): DeepLinkSelection | null {
  for (const book of availableBooks) {
    const waypoint = bookModels[book.id].waypointById[locationId]

    if (waypoint) {
      return {
        bookId: book.id,
        chapter: waypoint.chapter,
      }
    }
  }

  return null
}

export function resolveDeepLinkSelection(
  pathname = window.location.pathname,
  search = window.location.search,
): DeepLinkSelection | null {
  const params = new URLSearchParams(search)
  const queryBookId = params.get('book')
  const queryChapter = Number(params.get('chapter'))

  if (queryBookId && bookModels[queryBookId]) {
    return {
      bookId: queryBookId,
      chapter: Number.isFinite(queryChapter) ? queryChapter : undefined,
    }
  }

  const route = classifyPageRoute(pathname)

  if (route.kind === 'book' && bookModels[route.bookId]) {
    return {
      bookId: route.bookId,
      chapter: getLastChapter(route.bookId),
    }
  }

  if (route.kind === 'book-route' && bookModels[route.bookId]) {
    return {
      bookId: route.bookId,
      chapter: getLastChapter(route.bookId),
    }
  }

  if (route.kind === 'chapter' && bookModels[route.bookId]) {
    return {
      bookId: route.bookId,
      chapter: route.chapter,
    }
  }

  if (route.kind === 'location') {
    return resolveLocationSelection(route.locationId)
  }

  return null
}
