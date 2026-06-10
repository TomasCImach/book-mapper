export type PageRoute =
  | { kind: 'home' }
  | { kind: 'book'; bookId: string }
  | { kind: 'book-route'; bookId: string }
  | { kind: 'chapter'; bookId: string; chapter: number }
  | { kind: 'location'; locationId: string }
  | { kind: 'catalog'; catalog: 'titles' | 'authors' | 'locations' }
  | { kind: 'author'; authorSlug: string }
  | { kind: 'unknown' }

export function cleanPathParts(pathname: string) {
  return pathname
    .split('/')
    .map((part) => decodeURIComponent(part.trim()))
    .filter(Boolean)
}

function parseChapterSlug(slug: string | undefined) {
  const match = slug?.match(/^chapter-(\d+)$/)

  return match ? Number(match[1]) : undefined
}

export function classifyPageRoute(pathname = window.location.pathname): PageRoute {
  const parts = cleanPathParts(pathname)

  if (parts.length === 0) {
    return { kind: 'home' }
  }

  if (parts[0] === 'titles' || parts[0] === 'books') {
    if (!parts[1]) {
      return { kind: 'catalog', catalog: 'titles' }
    }

    if (parts[2] === 'route') {
      return { kind: 'book-route', bookId: parts[1] }
    }

    const chapter = parseChapterSlug(parts[2])

    if (typeof chapter === 'number') {
      return { kind: 'chapter', bookId: parts[1], chapter }
    }

    return { kind: 'book', bookId: parts[1] }
  }

  if (parts[0] === 'authors') {
    if (!parts[1]) {
      return { kind: 'catalog', catalog: 'authors' }
    }

    return { kind: 'author', authorSlug: parts[1] }
  }

  if (parts[0] === 'locations') {
    if (!parts[1]) {
      return { kind: 'catalog', catalog: 'locations' }
    }

    return { kind: 'location', locationId: parts[1] }
  }

  return { kind: 'unknown' }
}

export function isMapCapableRoute(route: PageRoute) {
  return (
    route.kind === 'home' ||
    route.kind === 'book' ||
    route.kind === 'book-route' ||
    route.kind === 'chapter' ||
    route.kind === 'location'
  )
}
