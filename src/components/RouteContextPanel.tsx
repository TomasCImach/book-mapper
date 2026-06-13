import { Info, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  availableBooks,
  bookModels,
  getBookModel,
  getCurrentChapterSegments,
  getVisibleSegments,
  type BookModel,
  type Waypoint,
} from '../data/journey'
import {
  formatDistance,
  getCumulativeDistanceKm,
  getSegmentDistanceKm,
} from '../lib/geo'
import { classifyPageRoute, type PageRoute } from '../lib/pageRoutes'
import {
  formatDepthDelta,
  formatSlope,
  getChapterRouteAnalysis,
} from '../lib/routeAnalysis'
import { getRouteAnalyticsProperties, trackEvent } from '../lib/analytics'
import { useMapStore } from '../store/mapStore'

type LocationAppearance = {
  model: BookModel
  waypoint: Waypoint
}

export function RouteContextPanel() {
  const route = useMemo(() => classifyPageRoute(), [])
  const [isOpen, setIsOpen] = useState(() =>
    typeof window === 'undefined'
      ? true
      : window.matchMedia('(min-width: 720px)').matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 720px)')

    function handleViewportChange(event: MediaQueryListEvent) {
      if (!event.matches) {
        setIsOpen(false)
      }
    }

    mediaQuery.addEventListener('change', handleViewportChange)

    return () => mediaQuery.removeEventListener('change', handleViewportChange)
  }, [])

  if (route.kind === 'home' || route.kind === 'catalog' || route.kind === 'author') {
    return null
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        className="context-chip"
        aria-label="Open map context"
        aria-expanded={false}
        onClick={() => {
          setIsOpen(true)
          trackEvent('context_panel_opened', getRouteAnalyticsProperties(route))
        }}
      >
        <Info size={16} strokeWidth={2.2} />
        <span>Context</span>
      </button>
    )
  }

  return (
    <aside className="context-panel" aria-label="Focused map context">
      <button
        type="button"
        className="context-close"
        aria-label="Close map context"
        onClick={() => {
          setIsOpen(false)
          trackEvent('context_panel_closed', getRouteAnalyticsProperties(route))
        }}
      >
        <X size={16} strokeWidth={2.2} />
      </button>
      <ContextPanelBody route={route} />
    </aside>
  )
}

function ContextPanelBody({ route }: { route: PageRoute }) {
  const selectedBookId = useMapStore((state) => state.selectedBookId)
  const selectedChapter = useMapStore((state) => state.selectedChapter)
  const setSelectedBookId = useMapStore((state) => state.setSelectedBookId)
  const setSelectedChapter = useMapStore((state) => state.setSelectedChapter)
  const bookModel = useMemo(() => getBookModel(selectedBookId), [selectedBookId])
  const { book, chapterByNumber, mediumLabels, routeSegments, waypointById } = bookModel
  const visibleSegments = useMemo(
    () => getVisibleSegments(selectedChapter, routeSegments),
    [routeSegments, selectedChapter],
  )
  const currentSegments = useMemo(
    () => getCurrentChapterSegments(selectedChapter, routeSegments),
    [routeSegments, selectedChapter],
  )
  const firstSegment = routeSegments[0]
  const lastSegment = routeSegments.at(-1)
  const chapter = chapterByNumber[selectedChapter]
  const chapterAnalysis = useMemo(
    () => getChapterRouteAnalysis(selectedChapter, bookModel),
    [bookModel, selectedChapter],
  )
  const totalDistance = getCumulativeDistanceKm(routeSegments, waypointById)
  const visibleDistance = getCumulativeDistanceKm(visibleSegments, waypointById)
  const currentDistance = currentSegments.reduce(
    (total, segment) => total + getSegmentDistanceKm(segment, waypointById),
    0,
  )

  if (route.kind === 'location') {
    const appearances = getLocationAppearances(route.locationId)
    const activeWaypoint = bookModel.waypointById[route.locationId] ?? appearances[0]?.waypoint

    return (
      <>
        <p className="context-kicker">Location focus</p>
        <h2>{activeWaypoint?.name ?? route.locationId}</h2>
        {activeWaypoint ? (
          <>
            <p className="context-copy">
              {formatCoordinate(activeWaypoint.position.lat, 'lat')},{' '}
              {formatCoordinate(activeWaypoint.position.lon, 'lon')}
              {activeWaypoint.position.depthKm
                ? `, ${activeWaypoint.position.depthKm} km modeled depth`
                : ', surface waypoint'}
              . Confidence: {activeWaypoint.confidence}.
            </p>
            {activeWaypoint.notes ? (
              <p className="context-note">{activeWaypoint.notes}</p>
            ) : null}
          </>
        ) : null}
        <div className="context-facts">
          <ContextFact label="Appearances" value={String(appearances.length)} />
          <ContextFact label="Title" value={book.title} />
          <ContextFact label="Chapter" value={String(selectedChapter)} />
        </div>
        {appearances.length > 1 ? (
          <div className="appearance-list" aria-label="Location appearances">
            {appearances.map(({ model, waypoint }) => (
              <button
                key={`${model.book.id}-${waypoint.chapter}`}
                type="button"
                className={
                  model.book.id === selectedBookId && waypoint.chapter === selectedChapter
                    ? 'appearance-button active'
                    : 'appearance-button'
                }
                onClick={() => {
                  setSelectedBookId(model.book.id)
                  setSelectedChapter(waypoint.chapter)
                  trackEvent('location_appearance_selected', {
                    location_id: route.locationId,
                    book_id: model.book.id,
                    book_title: model.book.title,
                    chapter_number: waypoint.chapter,
                    location_name: waypoint.name,
                  })
                }}
              >
                <span>{model.book.title}</span>
                <strong>Chapter {waypoint.chapter}</strong>
              </button>
            ))}
          </div>
        ) : null}
      </>
    )
  }

  if (route.kind === 'chapter') {
    return (
      <>
        <p className="context-kicker">{book.title}</p>
        <h2>
          Chapter {selectedChapter}: {chapter?.title ?? 'Unmapped chapter'}
        </h2>
        <p className="context-copy">{chapterAnalysis.fact.anchor}</p>
        <div className="context-facts">
          <ContextFact label="This chapter" value={formatDistance(currentDistance)} />
          <ContextFact
            label="Depth delta"
            value={formatDepthDelta(chapterAnalysis.depthDeltaKm)}
          />
          <ContextFact
            label="Slope"
            value={formatSlope(
              chapterAnalysis.slopeAngleDegrees,
              chapterAnalysis.gradePercent,
            )}
          />
        </div>
        <ul className="context-list">
          {chapterAnalysis.fact.locationFacts.slice(0, 2).map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </>
    )
  }

  if (route.kind === 'book-route') {
    return (
      <>
        <p className="context-kicker">Complete route audit</p>
        <h2>{book.title}</h2>
        <p className="context-copy">
          The full route is visible. Select any tube or segment to inspect its medium,
          source confidence, and distance basis.
        </p>
        <div className="context-facts">
          <ContextFact label="Total distance" value={formatDistance(totalDistance)} />
          <ContextFact label="Segments" value={String(routeSegments.length)} />
          <ContextFact label="Media" value={String(Object.keys(mediumLabels).length)} />
        </div>
      </>
    )
  }

  if (route.kind === 'book') {
    return (
      <>
        <p className="context-kicker">Completed title route</p>
        <h2>{book.title}</h2>
        <p className="context-copy">
          {firstSegment && lastSegment
            ? `${waypointById[firstSegment.from].name} to ${waypointById[lastSegment.to].name}.`
            : 'The mapped route is loaded.'}{' '}
          Use the chapter timeline to replay the journey.
        </p>
        <div className="context-facts">
          <ContextFact label="Visible distance" value={formatDistance(visibleDistance)} />
          <ContextFact label="Chapters" value={`${book.chapters[0].number}-${book.chapters.at(-1)?.number}`} />
          <ContextFact label="Segments" value={String(routeSegments.length)} />
        </div>
        <a
          className="context-source"
          href={book.source.url}
          target="_blank"
          rel="noreferrer"
          data-analytics-event="source_link_clicked"
          data-analytics-location="context_panel"
        >
          {book.source.label}
        </a>
      </>
    )
  }

  return null
}

function ContextFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="context-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function getLocationAppearances(locationId: string): LocationAppearance[] {
  return availableBooks
    .map((book) => {
      const model = bookModels[book.id]
      const waypoint = model.waypointById[locationId]

      return waypoint ? { model, waypoint } : null
    })
    .filter((appearance): appearance is LocationAppearance => Boolean(appearance))
}

function formatCoordinate(value: number, axis: 'lat' | 'lon') {
  const direction =
    axis === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W'

  return `${Math.abs(value).toFixed(3)} deg ${direction}`
}
