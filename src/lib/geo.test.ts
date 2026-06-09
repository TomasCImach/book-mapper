import { describe, expect, it } from 'vitest'
import {
  EARTH_RENDER_RADIUS,
  formatDistance,
  haversineDistanceKm,
  interpolatePosition,
  positionToVector3,
} from './geo'

describe('geo utilities', () => {
  it('computes a plausible Hamburg to Kiel distance', () => {
    const distance = haversineDistanceKm(
      { lat: 53.5503, lon: 9.9937 },
      { lat: 54.3233, lon: 10.1228 },
    )

    expect(distance).toBeGreaterThan(85)
    expect(distance).toBeLessThan(90)
  })

  it('keeps true-scale surface points on the render radius', () => {
    const point = positionToVector3({ lat: 0, lon: 0 }, 1)

    expect(point.length()).toBeCloseTo(EARTH_RENDER_RADIUS, 5)
  })

  it('pushes exaggerated depth visibly inward', () => {
    const trueScale = positionToVector3({ lat: 64, lon: -23, depthKm: 80 }, 1)
    const exaggerated = positionToVector3({ lat: 64, lon: -23, depthKm: 80 }, 24)

    expect(exaggerated.length()).toBeLessThan(trueScale.length())
    expect(trueScale.length()).toBeGreaterThan(5.9)
  })

  it('keeps submerged dateline routes on the short Pacific arc', () => {
    const midpoint = interpolatePosition(
      { lat: 35, lon: 178, depthKm: 0.05 },
      { lat: 32.6667, lon: -157.8333, depthKm: 0.05 },
      0.5,
    )

    expect(Math.abs(midpoint.lon)).toBeGreaterThan(165)
    expect(midpoint.depthKm).toBeCloseTo(0.05)
  })

  it('interpolates depth for same-coordinate dives', () => {
    const midpoint = interpolatePosition(
      { lat: 64, lon: -23, depthKm: 0 },
      { lat: 64, lon: -23, depthKm: 80 },
      0.5,
    )

    expect(midpoint.lat).toBeCloseTo(64)
    expect(midpoint.lon).toBeCloseTo(-23)
    expect(midpoint.depthKm).toBeCloseTo(40)
  })

  it('formats route distances for dense UI labels', () => {
    expect(formatDistance(5.25)).toBe('5.3 km')
    expect(formatDistance(45.6)).toBe('46 km')
    expect(formatDistance(1304)).toBe('1,304 km')
  })
})
