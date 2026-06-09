import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
import { useEffect, useMemo, type ReactNode } from 'react'
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

  return (
    <aside className="map-ui" aria-label="Book map controls">
      <header className="app-header">
        <div>
          <p className="eyebrow">Mapped Fiction route atlas</p>
          <h1>{book.title}</h1>
        </div>
        <a href={book.source.url} target="_blank">
          {book.source.label}
        </a>
      </header>

      <label className="book-selector">
        <span>Book</span>
        <select
          value={book.id}
          onChange={(event) => setSelectedBookId(event.target.value)}
        >
          {availableBooks.map((availableBook) => (
            <option key={availableBook.id} value={availableBook.id}>
              {availableBook.title}
            </option>
          ))}
        </select>
      </label>

      <section className="timeline-panel" aria-label="Chapter timeline">
        <div className="chapter-line">
          <span>Chapter {selectedChapter}</span>
          <strong>{chapter?.title ?? 'Unmapped chapter'}</strong>
        </div>

        <div className="transport-controls">
          <IconButton label="Previous chapter" onClick={previousChapter}>
            <SkipBack size={18} strokeWidth={2.1} />
          </IconButton>
          <IconButton
            label={isPlaying ? 'Pause chapter playback' : 'Play chapter playback'}
            onClick={() => setIsPlaying(!isPlaying)}
            prominent
          >
            {isPlaying ? (
              <Pause size={18} strokeWidth={2.2} />
            ) : (
              <Play size={18} strokeWidth={2.2} />
            )}
          </IconButton>
          <IconButton label="Next chapter" onClick={nextChapter}>
            <SkipForward size={18} strokeWidth={2.1} />
          </IconButton>
          <IconButton label="Reset map" onClick={reset}>
            <RotateCcw size={18} strokeWidth={2.1} />
          </IconButton>
        </div>

        <input
          type="range"
          min={chapters[0].number}
          max={chapters[chapters.length - 1].number}
          value={selectedChapter}
          aria-label="Selected chapter"
          onChange={(event) => setSelectedChapter(Number(event.target.value))}
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
            onChange={toggleDepthExaggeration}
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
              onClick={() => setSelectedSegmentId(segment.id)}
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
            <a href={ref.url} target="_blank">
              Ch. {ref.chapter}: {ref.label}
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}
