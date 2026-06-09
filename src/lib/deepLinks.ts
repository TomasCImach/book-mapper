import { availableBooks, bookModels, getBookModel } from '../data/journey'

export type DeepLinkSelection = {
  bookId: string
  chapter?: number
}

function cleanPath(pathname: string) {
  return pathname
    .split('/')
    .map((part) => decodeURIComponent(part.trim()))
    .filter(Boolean)
}

function parseChapterSlug(slug: string | undefined) {
  const match = slug?.match(/^chapter-(\d+)$/)

  return match ? Number(match[1]) : undefined
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

  const parts = cleanPath(pathname)

  if (parts[0] === 'books' && parts[1] && bookModels[parts[1]]) {
    const bookId = parts[1]
    const chapter = parseChapterSlug(parts[2])

    return {
      bookId,
      chapter: chapter ?? (parts[2] === 'route' ? getLastChapter(bookId) : undefined),
    }
  }

  if (parts[0] === 'locations' && parts[1]) {
    return resolveLocationSelection(parts[1])
  }

  return null
}
