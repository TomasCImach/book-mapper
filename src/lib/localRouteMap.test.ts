import { describe, expect, it } from 'vitest'
import { bookModels } from '../data/journey'
import { getLocalRouteMapData } from './localRouteMap'

describe('local route map data', () => {
  it('builds city-scale GeoJSON for Queen Elizabeth with real route bounds', () => {
    const model = bookModels['memoirs-of-the-court-of-queen-elizabeth']
    const data = getLocalRouteMapData(model, 28, 'tilbury-richmond')

    expect(data?.mode).toBe('city')
    expect(data?.routeFeatures.features).toHaveLength(5)
    expect(data?.waypointFeatures.features).toHaveLength(6)
    expect(data?.bounds).toEqual([
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    ])
    expect(data?.bounds?.[0]).toBeLessThan(-0.3)
    expect(data?.bounds?.[2]).toBeGreaterThan(0.35)
  })

  it('labels the active local endpoints without labeling every dense city waypoint', () => {
    const model = bookModels['memoirs-of-the-court-of-queen-elizabeth']
    const data = getLocalRouteMapData(model, 28, 'tilbury-richmond')
    const labeledNames = new Set(
      data?.waypointFeatures.features
        .filter((feature) => feature.properties.showLabel)
        .map((feature) => feature.properties.name),
    )

    expect(labeledNames).toEqual(new Set(['Richmond Palace', 'Tilbury']))
  })

  it('does not build local map data for globe-scale routes', () => {
    expect(
      getLocalRouteMapData(
        bookModels['around-the-world-in-eighty-days'],
        37,
        'reform-club-finish',
      ),
    ).toBeNull()
  })

  it('builds MapLibre data for the regional Genesis routes', () => {
    for (const bookId of ['genesis-abraham', 'genesis-jacob', 'genesis-joseph']) {
      const model = bookModels[bookId]
      const data = getLocalRouteMapData(
        model,
        model.chapters.at(-1)!.number,
        model.routeSegments.at(-1)!.id,
      )

      expect(data?.mode).toBe('country')
      expect(data?.routeFeatures.features.length).toBe(model.routeSegments.length)
      expect(data?.bounds).not.toBeNull()
    }
  })
})
