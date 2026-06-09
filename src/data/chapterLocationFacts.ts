import {
  chapters,
  currentBook,
  currentBookModel,
  routeSegments,
  type BookMapData,
  type BookModel,
  type Confidence,
  type SourceRef,
} from './journey'

export type ChapterMovementKind =
  | 'stationary'
  | 'surface'
  | 'sea'
  | 'ascent'
  | 'descent'
  | 'wrong-turn'
  | 'subterranean'
  | 'raft'
  | 'volcanic'
  | 'return'

export type ChapterLocationFact = {
  chapter: number
  movement: ChapterMovementKind
  anchor: string
  locationFacts: string[]
  deltaFacts: string[]
  slopeFacts: string[]
  xyzEstimate: string
  segmentIds: string[]
  confidence: Confidence
  sourceRefs: SourceRef[]
}

export function getChapterLocationFacts(book: BookMapData = currentBook) {
  return book.chapterFacts as ChapterLocationFact[]
}

export function getChapterLocationFactByNumber(book: BookMapData = currentBook) {
  return Object.fromEntries(
    getChapterLocationFacts(book).map((fact) => [fact.chapter, fact]),
  ) as Record<number, ChapterLocationFact>
}

export const chapterLocationFacts = getChapterLocationFacts(currentBook)

export const chapterLocationFactByNumber = getChapterLocationFactByNumber(currentBook)

export function validateChapterLocationFacts(model: BookModel = currentBookModel) {
  const errors: string[] = []
  const activeChapters = model === currentBookModel ? chapters : model.chapters
  const activeRouteSegments =
    model === currentBookModel ? routeSegments : model.routeSegments
  const chapterNumbers = new Set(activeChapters.map((chapter) => chapter.number))
  const segmentIds = new Set(activeRouteSegments.map((segment) => segment.id))
  const factNumbers = new Set<number>()

  for (const fact of getChapterLocationFacts(model.book)) {
    if (!chapterNumbers.has(fact.chapter)) {
      errors.push(`Chapter fact references missing chapter ${fact.chapter}`)
    }
    if (factNumbers.has(fact.chapter)) {
      errors.push(`Duplicate chapter fact ${fact.chapter}`)
    }
    factNumbers.add(fact.chapter)
    if (!fact.locationFacts.length) {
      errors.push(`Chapter ${fact.chapter} has no location facts`)
    }
    if (!fact.deltaFacts.length) {
      errors.push(`Chapter ${fact.chapter} has no delta facts`)
    }
    if (!fact.slopeFacts.length) {
      errors.push(`Chapter ${fact.chapter} has no slope facts`)
    }
    if (!fact.sourceRefs.length) {
      errors.push(`Chapter ${fact.chapter} has no source references`)
    }

    for (const segmentId of fact.segmentIds) {
      if (!segmentIds.has(segmentId)) {
        errors.push(`Chapter ${fact.chapter} references missing segment ${segmentId}`)
      }
    }
  }

  for (const chapterNumber of chapterNumbers) {
    if (!factNumbers.has(chapterNumber)) {
      errors.push(`Missing chapter fact ${chapterNumber}`)
    }
  }

  return errors
}
