import { describe, expect, it } from 'vitest'
import { bookModels } from '../data/journey'
import { EARTH_RENDER_RADIUS, getSegmentRenderPoints } from './geo'
import {
  getRouteViewportProfile,
  getViewportSegmentRenderPoints,
} from './routeViewport'

describe('route viewport profiles', () => {
  it('classifies compact indexed routes into city and country modes', () => {
    expect(
      getRouteViewportProfile(bookModels['alices-adventures-in-wonderland']).mode,
    ).toBe('city')
    expect(
      getRouteViewportProfile(
        bookModels['memoirs-of-the-court-of-queen-elizabeth'],
      ).mode,
    ).toBe('city')
    expect(
      getRouteViewportProfile(
        bookModels['the-adventures-of-sherlock-holmes'],
      ).mode,
    ).toBe('country')
    expect(getRouteViewportProfile(bookModels['pride-and-prejudice']).mode).toBe(
      'country',
    )
    expect(
      getRouteViewportProfile(bookModels['around-the-world-in-eighty-days']).mode,
    ).toBe('global')
  })

  it('renders regional biblical routes as MapLibre local maps', () => {
    for (const bookId of [
      'genesis-abraham',
      'genesis-jacob',
      'genesis-joseph',
      'exodus-to-promised-land',
    ]) {
      const profile = getRouteViewportProfile(bookModels[bookId])

      expect(profile.mode).toBe('country')
      expect(profile.isLocal).toBe(true)
      expect(profile.extentKm).toBeGreaterThan(350)
    }
  })

  it('keeps concentrated route geometry anchored to the globe surface', () => {
    const model = bookModels['memoirs-of-the-court-of-queen-elizabeth']
    const segment = model.routeSegments[0]
    const profile = getRouteViewportProfile(model)
    const globalPoints = getSegmentRenderPoints(segment, 1, model.waypointById)
    const localPoints = getViewportSegmentRenderPoints(
      segment,
      1,
      model.waypointById,
      profile,
    )

    expect(localPoints).toHaveLength(globalPoints.length)
    expect(localPoints[0].length()).toBeCloseTo(
      EARTH_RENDER_RADIUS + profile.surfaceOffset,
      3,
    )
    expect(localPoints[0].clone().normalize().dot(globalPoints[0].clone().normalize()))
      .toBeGreaterThan(0.999)
    expect(localPoints.at(-1)!.clone().normalize().dot(
      globalPoints.at(-1)!.clone().normalize(),
    )).toBeGreaterThan(0.999)
  })
})
