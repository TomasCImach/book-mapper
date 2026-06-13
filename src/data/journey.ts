import aroundWorldJson from './books/around-the-world-in-eighty-days.json'
import aliceJson from './books/alices-adventures-in-wonderland.json'
import roomViewJson from './books/a-room-with-a-view.json'
import crimePunishmentJson from './books/crime-and-punishment.json'
import draculaJson from './books/dracula.json'
import forrestGumpJson from './books/forrest-gump.json'
import frankensteinJson from './books/frankenstein.json'
import journeyJson from './books/journey-to-the-center-of-the-earth.json'
import littleWomenJson from './books/little-women.json'
import memoirsQueenElizabethJson from './books/memoirs-of-the-court-of-queen-elizabeth.json'
import middlemarchJson from './books/middlemarch.json'
import mobyDickJson from './books/moby-dick.json'
import monteCristoJson from './books/the-count-of-monte-cristo.json'
import myLifeJson from './books/my-life-volume-1.json'
import pridePrejudiceJson from './books/pride-and-prejudice.json'
import sherlockHolmesJson from './books/the-adventures-of-sherlock-holmes.json'
import leaguesJson from './books/twenty-thousand-leagues-under-the-sea.json'

export type TravelMedium = string

export type Confidence =
  | 'confirmed'
  | 'geocoded'
  | 'textual'
  | 'estimated'
  | 'fictional'
  | 'book'

export type Position = {
  lat: number
  lon: number
  depthKm?: number
}

export type Waypoint = {
  id: string
  name: string
  chapter: number
  position: Position
  confidence: Confidence
  notes?: string
}

export type SourceRef = {
  chapter: number
  label: string
  url: string
}

export type DistanceSource = 'geodesic' | 'book' | 'estimated' | 'cinematic'

const validConfidences = new Set<Confidence>([
  'confirmed',
  'geocoded',
  'textual',
  'estimated',
  'fictional',
  'book',
])

const validDistanceSources = new Set<DistanceSource>([
  'geodesic',
  'book',
  'estimated',
  'cinematic',
])

export type BookPath = {
  id: string
  chapterStart: number
  chapterEnd: number
  title: string
  start: {
    waypointId: string
  }
  end: {
    waypointId: string
  }
  medium: TravelMedium
  distanceKm?: number
  distanceSource: DistanceSource
  confidence: Confidence
  notes: string
  sourceRefs: SourceRef[]
  points?: Position[]
}

export type RouteSegment = {
  id: string
  chapterStart: number
  chapterEnd: number
  title: string
  from: string
  to: string
  medium: TravelMedium
  distanceKm?: number
  distanceSource: DistanceSource
  confidence: Confidence
  notes: string
  sourceRefs: SourceRef[]
  path?: Position[]
}

export type Chapter = {
  number: number
  title: string
}

export type BookMapData = {
  $schema?: string
  schemaVersion: number
  id: string
  title: string
  author: string
  source: {
    label: string
    url: string
  }
  chapters: Chapter[]
  media: Record<
    string,
    {
      label: string
      color: string
    }
  >
  waypoints: Waypoint[]
  paths: BookPath[]
  chapterFacts: unknown[]
}

export type BookModel = {
  book: BookMapData
  chapters: Chapter[]
  waypoints: Waypoint[]
  mediumLabels: Record<TravelMedium, string>
  mediumColors: Record<TravelMedium, string>
  routeSegments: RouteSegment[]
  waypointById: Record<string, Waypoint>
  chapterByNumber: Record<number, Chapter>
}

export const availableBooks = [
  journeyJson as BookMapData,
  aroundWorldJson as BookMapData,
  leaguesJson as BookMapData,
  mobyDickJson as BookMapData,
  forrestGumpJson as BookMapData,
  pridePrejudiceJson as BookMapData,
  roomViewJson as BookMapData,
  aliceJson as BookMapData,
  frankensteinJson as BookMapData,
  crimePunishmentJson as BookMapData,
  monteCristoJson as BookMapData,
  sherlockHolmesJson as BookMapData,
  middlemarchJson as BookMapData,
  memoirsQueenElizabethJson as BookMapData,
  littleWomenJson as BookMapData,
  myLifeJson as BookMapData,
  draculaJson as BookMapData,
]

export const DEFAULT_BOOK_ID = availableBooks[0].id

function createBookModel(book: BookMapData): BookModel {
  const chapters = book.chapters
  const waypoints = book.waypoints
  const mediumLabels = Object.fromEntries(
    Object.entries(book.media).map(([medium, value]) => [medium, value.label]),
  ) as Record<TravelMedium, string>
  const mediumColors = Object.fromEntries(
    Object.entries(book.media).map(([medium, value]) => [medium, value.color]),
  ) as Record<TravelMedium, string>
  const routeSegments = book.paths.map((path) => ({
    id: path.id,
    chapterStart: path.chapterStart,
    chapterEnd: path.chapterEnd,
    title: path.title,
    from: path.start.waypointId,
    to: path.end.waypointId,
    medium: path.medium,
    distanceKm: path.distanceKm,
    distanceSource: path.distanceSource,
    confidence: path.confidence,
    notes: path.notes,
    sourceRefs: path.sourceRefs,
    path: path.points,
  }))
  const waypointById = Object.fromEntries(
    waypoints.map((waypoint) => [waypoint.id, waypoint]),
  ) as Record<string, Waypoint>
  const chapterByNumber = Object.fromEntries(
    chapters.map((chapter) => [chapter.number, chapter]),
  ) as Record<number, Chapter>

  return {
    book,
    chapters,
    waypoints,
    mediumLabels,
    mediumColors,
    routeSegments,
    waypointById,
    chapterByNumber,
  }
}

export const bookModels = Object.fromEntries(
  availableBooks.map((book) => [book.id, createBookModel(book)]),
) as Record<string, BookModel>

export function getBookModel(bookId: string) {
  return bookModels[bookId] ?? bookModels[DEFAULT_BOOK_ID]
}

export function getFirstMappedChapter(model: BookModel) {
  return model.routeSegments[0]?.chapterStart ?? model.chapters[0].number
}

export const currentBookModel = getBookModel(DEFAULT_BOOK_ID)
export const currentBook = currentBookModel.book

export const GUTENBERG_URL = currentBook.source.url
export const chapters = currentBookModel.chapters
export const waypoints = currentBookModel.waypoints
export const mediumLabels = currentBookModel.mediumLabels
export const mediumColors = currentBookModel.mediumColors
export const routeSegments = currentBookModel.routeSegments
export const waypointById = currentBookModel.waypointById
export const chapterByNumber = currentBookModel.chapterByNumber

export function getVisibleSegments(
  chapter: number,
  segments: RouteSegment[] = routeSegments,
) {
  return segments.filter((segment) => segment.chapterStart <= chapter)
}

export function getCurrentChapterSegments(
  chapter: number,
  segments: RouteSegment[] = routeSegments,
) {
  return segments.filter(
    (segment) => segment.chapterStart <= chapter && segment.chapterEnd >= chapter,
  )
}

export function getSegmentWaypoints(
  segment: RouteSegment,
  waypointsById: Record<string, Waypoint> = waypointById,
): Waypoint[] {
  return [waypointsById[segment.from], waypointsById[segment.to]]
}

export function validateJourneyData(model: BookModel = currentBookModel) {
  const errors: string[] = []
  const waypointIds = new Set<string>()
  const mediaIds = new Set(Object.keys(model.book.media))

  for (const waypoint of model.waypoints) {
    if (waypointIds.has(waypoint.id)) {
      errors.push(`Duplicate waypoint id: ${waypoint.id}`)
    }
    waypointIds.add(waypoint.id)

    if (waypoint.position.lat < -90 || waypoint.position.lat > 90) {
      errors.push(`Invalid latitude for ${waypoint.id}`)
    }
    if (waypoint.position.lon < -180 || waypoint.position.lon > 180) {
      errors.push(`Invalid longitude for ${waypoint.id}`)
    }
    if (!validConfidences.has(waypoint.confidence)) {
      errors.push(`Invalid confidence ${waypoint.confidence} in ${waypoint.id}`)
    }
  }

  for (const path of model.book.paths) {
    if (!model.waypointById[path.start.waypointId]) {
      errors.push(`Missing start waypoint ${path.start.waypointId} in ${path.id}`)
    }
    if (!model.waypointById[path.end.waypointId]) {
      errors.push(`Missing end waypoint ${path.end.waypointId} in ${path.id}`)
    }
    if (!mediaIds.has(path.medium)) {
      errors.push(`Missing medium ${path.medium} in ${path.id}`)
    }
    if (!validDistanceSources.has(path.distanceSource)) {
      errors.push(`Invalid distance source ${path.distanceSource} in ${path.id}`)
    }
    if (!validConfidences.has(path.confidence)) {
      errors.push(`Invalid confidence ${path.confidence} in ${path.id}`)
    }
    if (!path.sourceRefs.length) {
      errors.push(`Missing source refs in ${path.id}`)
    }
    if (path.chapterStart > path.chapterEnd) {
      errors.push(`Invalid chapter range in ${path.id}`)
    }
  }

  return errors
}
