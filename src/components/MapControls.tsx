import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import type { ChapterLocationFact } from '../data/chapterLocationFacts'
import {
  availableBooks,
  getBookModel,
  getCurrentChapterSegments,
  getVisibleSegments,
  type BookModel,
  type RouteSegment,
} from '../data/journey'
import {
  formatDistance,
  getCumulativeDistanceKm,
  getSegmentDistanceKm,
} from '../lib/geo'
import {
  formatDepthDelta,
  formatSlope,
  formatXyzDelta,
  getChapterRouteAnalysis,
  type ChapterRouteAnalysis,
} from '../lib/routeAnalysis'
import { trackEvent } from '../lib/analytics'
import { useMapStore } from '../store/mapStore'

export function MapControls() {
  const selectedBookId = useMapStore((state) => state.selectedBookId)
  const selectedChapter = useMapStore((state) => state.selectedChapter)
  const selectedSegmentId = useMapStore((state) => state.selectedSegmentId)
  const isPlaying = useMapStore((state) => state.isPlaying)
  const depthExaggerated = useMapStore((state) => state.depthExaggerated)
  const setSelectedBookId = useMapStore((state) => state.setSelectedBookId)
  const setSelectedChapter = useMapStore((state) => state.setSelectedChapter)
  const setSelectedSegmentId = useMapStore((state) => state.setSelectedSegmentId)
  const setIsPlaying = useMapStore((state) => state.setIsPlaying)
  const toggleDepthExaggeration = useMapStore((state) => state.toggleDepthExaggeration)
  const previousChapter = useMapStore((state) => state.previousChapter)
  const nextChapter = useMapStore((state) => state.nextChapter)
  const reset = useMapStore((state) => state.reset)
  const chapterSliderStartRef = useRef(selectedChapter)
  const lastTrackedChapterRef = useRef('')
  const bookModel = useMemo(() => getBookModel(selectedBookId), [selectedBookId])
  const {
    book,
    chapterByNumber,
    chapters,
    mediumColors,
    mediumLabels,
    routeSegments,
    waypointById,
  } = bookModel

  const visibleSegments = useMemo(
    () => getVisibleSegments(selectedChapter, routeSegments),
    [routeSegments, selectedChapter],
  )
  const currentSegments = useMemo(
    () => getCurrentChapterSegments(selectedChapter, routeSegments),
    [routeSegments, selectedChapter],
  )
  const chapterAnalysis = useMemo(
    () => getChapterRouteAnalysis(selectedChapter, bookModel),
    [bookModel, selectedChapter],
  )
  const selectedSegment =
    visibleSegments.find((segment) => segment.id === selectedSegmentId) ??
    visibleSegments[visibleSegments.length - 1]
  const chapter = chapterByNumber[selectedChapter]
  const cumulativeDistance = getCumulativeDistanceKm(visibleSegments, waypointById)
  const currentDistance = currentSegments.reduce(
    (total, segment) => total + getSegmentDistanceKm(segment, waypointById),
    0,
  )

  useEffect(() => {
    if (!isPlaying) {
      return
    }

    const timer = window.setInterval(() => {
      useMapStore.getState().nextChapter()
    }, 1400)

    return () => window.clearInterval(timer)
  }, [isPlaying])

  function trackChapterSelection(
    method: string,
    previousChapterNumber: number,
    nextChapterNumber: number,
  ) {
    if (previousChapterNumber === nextChapterNumber) {
      return
    }

    const eventKey = `${book.id}:${method}:${previousChapterNumber}:${nextChapterNumber}`

    if (lastTrackedChapterRef.current === eventKey) {
      return
    }

    lastTrackedChapterRef.current = eventKey

    trackEvent('chapter_selected', {
      book_id: book.id,
      book_title: book.title,
      chapter_number: nextChapterNumber,
      chapter_title: chapterByNumber[nextChapterNumber]?.title,
      previous_chapter: previousChapterNumber,
      method,
    })
  }

  function trackSegmentSelection(segment: RouteSegment, method: string) {
    trackEvent('route_segment_selected', {
      book_id: book.id,
      book_title: book.title,
      segment_id: segment.id,
      segment_title: segment.title,
      chapter_start: segment.chapterStart,
      chapter_end: segment.chapterEnd,
      medium: segment.medium,
      medium_label: mediumLabels[segment.medium],
      distance_km: Math.round(getSegmentDistanceKm(segment, waypointById) * 100) / 100,
      method,
    })
  }

  function handleBookChange(bookId: string) {
    const nextBook = availableBooks.find((availableBook) => availableBook.id === bookId)

    trackEvent('book_selected', {
      book_id: bookId,
      book_title: nextBook?.title,
      previous_book_id: book.id,
      method: 'book_selector',
    })

    setSelectedBookId(bookId)
  }

  function handlePreviousChapter() {
    const previousChapterNumber = selectedChapter

    previousChapter()
    trackChapterSelection(
      'previous_button',
      previousChapterNumber,
      useMapStore.getState().selectedChapter,
    )
  }

  function handleNextChapter() {
    const previousChapterNumber = selectedChapter

    nextChapter()
    trackChapterSelection(
      'next_button',
      previousChapterNumber,
      useMapStore.getState().selectedChapter,
    )
  }

  function handlePlaybackToggle() {
    const nextIsPlaying = !isPlaying

    setIsPlaying(nextIsPlaying)
    trackEvent(
      nextIsPlaying ? 'chapter_playback_started' : 'chapter_playback_paused',
      {
        book_id: book.id,
        book_title: book.title,
        chapter_number: selectedChapter,
      },
    )
  }

  function handleChapterSliderStart() {
    chapterSliderStartRef.current = useMapStore.getState().selectedChapter
  }

  function handleChapterSliderCommit(method: string) {
    trackChapterSelection(
      method,
      chapterSliderStartRef.current,
      useMapStore.getState().selectedChapter,
    )
  }

  function handleDepthToggle() {
    const nextDepthExaggerated = !depthExaggerated

    toggleDepthExaggeration()
    trackEvent('depth_mode_toggled', {
      book_id: book.id,
      book_title: book.title,
      chapter_number: selectedChapter,
      depth_exaggerated: nextDepthExaggerated,
    })
  }

  function handleReset() {
    const previousChapterNumber = selectedChapter
    const previousDepthExaggerated = depthExaggerated

    reset()

    const state = useMapStore.getState()

    trackEvent('map_reset', {
      book_id: state.selectedBookId,
      previous_chapter: previousChapterNumber,
      chapter_number: state.selectedChapter,
      previous_depth_exaggerated: previousDepthExaggerated,
      depth_exaggerated: state.depthExaggerated,
    })
  }

  return (
    <aside className="map-ui" aria-label="Title map controls">
      <header className="app-header">
        <div className="brand-row">
          <img
            className="brand-logo"
            src="/mappedfiction-logo.svg"
            alt="Mapped Fiction"
          />
          <a
            href={book.source.url}
            target="_blank"
            rel="noreferrer"
            data-analytics-event="source_link_clicked"
            data-analytics-location="app_header"
          >
            {book.source.label}
          </a>
        </div>
        <h1>{book.title}</h1>
      </header>

      <section className="book-selector" aria-label="Title selection">
        <div className="book-selector-heading">
          <label htmlFor="book-select">Title</label>
          <a
            href="/titles/"
            data-analytics-event="navigation_link_clicked"
            data-analytics-location="book_selector"
          >
            All titles
          </a>
        </div>
        <select
          id="book-select"
          value={book.id}
          onChange={(event) => handleBookChange(event.target.value)}
        >
          {availableBooks.map((availableBook) => (
            <option key={availableBook.id} value={availableBook.id}>
              {availableBook.title}
            </option>
          ))}
        </select>
      </section>

      <section className="timeline-panel" aria-label="Chapter timeline">
        <div className="chapter-line">
          <span>Chapter {selectedChapter}</span>
          <strong>{chapter?.title ?? 'Unmapped chapter'}</strong>
        </div>

        <div className="transport-controls">
          <IconButton label="Previous chapter" onClick={handlePreviousChapter}>
            <SkipBack size={18} strokeWidth={2.1} />
          </IconButton>
          <IconButton
            label={isPlaying ? 'Pause chapter playback' : 'Play chapter playback'}
            onClick={handlePlaybackToggle}
            prominent
          >
            {isPlaying ? (
              <Pause size={18} strokeWidth={2.2} />
            ) : (
              <Play size={18} strokeWidth={2.2} />
            )}
          </IconButton>
          <IconButton label="Next chapter" onClick={handleNextChapter}>
            <SkipForward size={18} strokeWidth={2.1} />
          </IconButton>
          <IconButton label="Reset map" onClick={handleReset}>
            <RotateCcw size={18} strokeWidth={2.1} />
          </IconButton>
        </div>

        <input
          type="range"
          min={chapters[0].number}
          max={chapters[chapters.length - 1].number}
          value={selectedChapter}
          aria-label="Selected chapter"
          onPointerDown={handleChapterSliderStart}
          onFocus={handleChapterSliderStart}
          onKeyDown={handleChapterSliderStart}
          onChange={(event) => setSelectedChapter(Number(event.target.value))}
          onPointerUp={() => handleChapterSliderCommit('chapter_slider')}
          onKeyUp={() => handleChapterSliderCommit('chapter_slider_keyboard')}
          onBlur={() => handleChapterSliderCommit('chapter_slider_blur')}
        />

        <div className="stats-grid">
          <Metric label="Visible route" value={formatDistance(cumulativeDistance)} />
          <Metric label="This chapter" value={formatDistance(currentDistance)} />
          <Metric label="Segments" value={String(visibleSegments.length)} />
        </div>

        <label className="depth-toggle">
          <input
            type="checkbox"
            checked={depthExaggerated}
            onChange={handleDepthToggle}
          />
          <span>Exaggerated depth</span>
        </label>
      </section>

      <section className="chapter-facts-panel" aria-label="Chapter location facts">
        <ChapterFactsPanel analysis={chapterAnalysis} />
      </section>

      <section className="details-panel" aria-label="Selected route details">
        {selectedSegment ? (
          <SegmentDetails
            mediumColors={mediumColors}
            mediumLabels={mediumLabels}
            segment={selectedSegment}
            waypointById={waypointById}
          />
        ) : null}
      </section>

      <section className="segments-panel" aria-label="Constructed route segments">
        <div className="panel-title-row">
          <h2>Constructed route</h2>
          <span>{visibleSegments.length}</span>
        </div>
        <div className="segment-list">
          {visibleSegments.map((segment) => (
            <button
              key={segment.id}
              type="button"
              className={segment.id === selectedSegment?.id ? 'segment-item active' : 'segment-item'}
              onClick={() => {
                setSelectedSegmentId(segment.id)
                trackSegmentSelection(segment, 'segment_list')
              }}
            >
              <span
                className="medium-dot"
                style={{ backgroundColor: mediumColors[segment.medium] }}
              />
              <span>{segment.title}</span>
              <small>{formatDistance(getSegmentDistanceKm(segment, waypointById))}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="legend-panel" aria-label="Travel medium legend">
        {Object.entries(mediumLabels).map(([medium, label]) => (
          <span key={medium} className="legend-pill">
            <i style={{ backgroundColor: mediumColors[medium as keyof typeof mediumColors] }} />
            {label}
          </span>
        ))}
      </section>
    </aside>
  )
}

function IconButton({
  label,
  children,
  prominent = false,
  onClick,
}: {
  label: string
  children: ReactNode
  prominent?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={prominent ? 'icon-button prominent' : 'icon-button'}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ChapterFactsPanel({ analysis }: { analysis: ChapterRouteAnalysis }) {
  const fact = analysis.fact

  return (
    <>
      <div className="panel-title-row">
        <h2>Chapter facts</h2>
        <span>{fact.movement}</span>
      </div>
      <p className="chapter-anchor">{fact.anchor}</p>
      <FactList fact={fact} />
      <div className="delta-grid">
        <Metric label="Chapter delta" value={formatDistance(analysis.distanceKm)} />
        <Metric label="Depth delta" value={formatDepthDelta(analysis.depthDeltaKm)} />
        <Metric
          label="Avg slope"
          value={formatSlope(analysis.slopeAngleDegrees, analysis.gradePercent)}
        />
      </div>
      <p className="xyz-delta">Delta XYZ: {formatXyzDelta(analysis.xyzDeltaKm)}</p>
      <p className="estimate-note">{fact.xyzEstimate}</p>
    </>
  )
}

function FactList({ fact }: { fact: ChapterLocationFact }) {
  return (
    <ul className="fact-list">
      {fact.locationFacts.map((item) => (
        <li key={`location-${item}`}>{item}</li>
      ))}
      {fact.deltaFacts.map((item) => (
        <li key={`delta-${item}`}>{item}</li>
      ))}
      {fact.slopeFacts.map((item) => (
        <li key={`slope-${item}`}>{item}</li>
      ))}
    </ul>
  )
}

function SegmentDetails({
  mediumColors,
  mediumLabels,
  segment,
  waypointById,
}: {
  mediumColors: Record<string, string>
  mediumLabels: Record<string, string>
  segment: RouteSegment
  waypointById: BookModel['waypointById']
}) {
  const from = waypointById[segment.from]
  const to = waypointById[segment.to]

  return (
    <>
      <div className="details-header">
        <span
          className="medium-dot"
          style={{ backgroundColor: mediumColors[segment.medium] }}
        />
        <p>{mediumLabels[segment.medium]}</p>
      </div>
      <h2>{segment.title}</h2>
      <dl className="details-grid">
        <div>
          <dt>From</dt>
          <dd>{from.name}</dd>
        </div>
        <div>
          <dt>To</dt>
          <dd>{to.name}</dd>
        </div>
        <div>
          <dt>Distance</dt>
          <dd>{formatDistance(getSegmentDistanceKm(segment, waypointById))}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{segment.distanceSource}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{segment.confidence}</dd>
        </div>
        <div>
          <dt>Chapters</dt>
          <dd>
            {segment.chapterStart}-{segment.chapterEnd}
          </dd>
        </div>
      </dl>
      <p className="segment-note">{segment.notes}</p>
      <ul className="source-list">
        {segment.sourceRefs.map((ref) => (
          <li key={`${segment.id}-${ref.chapter}-${ref.label}`}>
            <a
              href={ref.url}
              target="_blank"
              rel="noreferrer"
              data-analytics-event="source_link_clicked"
              data-analytics-location="route_details_sources"
            >
              Ch. {ref.chapter}: {ref.label}
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}
