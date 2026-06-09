import { describe, expect, it } from 'vitest'
import {
  chapterLocationFacts,
  validateChapterLocationFacts,
} from './chapterLocationFacts'
import {
  availableBooks,
  bookModels,
  chapters,
  currentBook,
  getVisibleSegments,
  routeSegments,
  validateJourneyData,
  waypoints,
} from './journey'
import { getCumulativeDistanceKm } from '../lib/geo'
import {
  analyzeSegment,
  validateChapterRouteAnalysis,
} from '../lib/routeAnalysis'

describe('journey dataset', () => {
  it('has a complete 45 chapter spine', () => {
    expect(chapters).toHaveLength(45)
    expect(chapters[0].number).toBe(1)
    expect(chapters.at(-1)?.number).toBe(45)
  })

  it('passes relationship and coordinate validation', () => {
    expect(validateJourneyData()).toEqual([])
  })

  it('validates every registered book dataset', () => {
    for (const book of availableBooks) {
      const model = bookModels[book.id]

      expect(validateJourneyData(model)).toEqual([])
      expect(validateChapterLocationFacts(model)).toEqual([])
      expect(validateChapterRouteAnalysis(model)).toEqual([])
    }
  })

  it('loads the current book from JSON path data', () => {
    expect(currentBook.id).toBe('journey-to-the-center-of-the-earth')
    expect(currentBook.paths).toHaveLength(routeSegments.length)
    expect(currentBook.paths[0].start.waypointId).toBe(routeSegments[0].from)
    expect(currentBook.paths[0].end.waypointId).toBe(routeSegments[0].to)
  })

  it('has a location fact ledger for every chapter', () => {
    expect(chapterLocationFacts).toHaveLength(chapters.length)
    expect(validateChapterLocationFacts()).toEqual([])
    expect(validateChapterRouteAnalysis()).toEqual([])
  })

  it('reveals more route as chapters advance', () => {
    expect(getVisibleSegments(1)).toHaveLength(0)
    expect(getVisibleSegments(8).length).toBeGreaterThan(0)
    expect(getVisibleSegments(45)).toHaveLength(routeSegments.length)
  })

  it('contains the key entry, sea, and exit waypoints', () => {
    const ids = new Set(waypoints.map((waypoint) => waypoint.id))

    expect(ids.has('scartaris-crater')).toBe(true)
    expect(ids.has('liedenbrock-sea')).toBe(true)
    expect(ids.has('stromboli')).toBe(true)
  })

  it('keeps the completed route in the intended long-journey range', () => {
    const distance = getCumulativeDistanceKm(routeSegments)

    expect(distance).toBeGreaterThan(8000)
    expect(distance).toBeLessThan(12000)
  })

  it('derives useful slope estimates for vertical and wrong-turn paths', () => {
    const vertical = analyzeSegment(
      routeSegments.find((segment) => segment.id === 'crater-vertical-descent')!,
    )
    const wrongTurn = analyzeSegment(
      routeSegments.find((segment) => segment.id === 'fork-eastern-blind-alley')!,
    )

    expect(vertical.slopeAngleDegrees).toBeGreaterThan(75)
    expect(wrongTurn.slopeAngleDegrees).toBeLessThan(1)
    expect(wrongTurn.slopeAngleDegrees).toBeGreaterThan(-1)
  })
})
