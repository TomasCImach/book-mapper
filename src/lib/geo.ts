import * as THREE from 'three'
import type { Position, RouteSegment, Waypoint } from '../data/journey'
import { waypointById } from '../data/journey'

export const EARTH_RADIUS_KM = 6371
export const EARTH_RENDER_RADIUS = 6
export const KM_PER_MILE = 1.609344
export const KM_PER_LEAGUE = 4.828032

export function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180
}

export function toDegrees(radians: number) {
  return (radians * 180) / Math.PI
}

export function haversineDistanceKm(a: Position, b: Position) {
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)
  const deltaLat = toRadians(b.lat - a.lat)
  const deltaLon = toRadians(b.lon - a.lon)

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function interpolateLatLon(a: Position, b: Position, t: number): Position {
  const lat1 = toRadians(a.lat)
  const lon1 = toRadians(a.lon)
  const lat2 = toRadians(b.lat)
  const lon2 = toRadians(b.lon)

  const delta = 2 * Math.asin(
    Math.sqrt(
      Math.sin((lat2 - lat1) / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
    ),
  )

  if (delta === 0) {
    return { ...a }
  }

  const factorA = Math.sin((1 - t) * delta) / Math.sin(delta)
  const factorB = Math.sin(t * delta) / Math.sin(delta)
  const x =
    factorA * Math.cos(lat1) * Math.cos(lon1) +
    factorB * Math.cos(lat2) * Math.cos(lon2)
  const y =
    factorA * Math.cos(lat1) * Math.sin(lon1) +
    factorB * Math.cos(lat2) * Math.sin(lon2)
  const z = factorA * Math.sin(lat1) + factorB * Math.sin(lat2)

  return {
    lat: toDegrees(Math.atan2(z, Math.sqrt(x * x + y * y))),
    lon: toDegrees(Math.atan2(y, x)),
    depthKm: lerp(a.depthKm ?? 0, b.depthKm ?? 0, t),
  }
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function interpolatePosition(a: Position, b: Position, t: number): Position {
  const aDepth = a.depthKm ?? 0
  const bDepth = b.depthKm ?? 0

  if (aDepth === 0 && bDepth === 0) {
    return interpolateLatLon(a, b, t)
  }

  return {
    lat: lerp(a.lat, b.lat, t),
    lon: lerp(a.lon, b.lon, t),
    depthKm: lerp(aDepth, bDepth, t),
  }
}

export function positionToVector3(position: Position, depthScale: number) {
  const lat = toRadians(position.lat)
  const lon = toRadians(position.lon)
  const depthKm = position.depthKm ?? 0
  const scaledDepth = (depthKm / EARTH_RADIUS_KM) * EARTH_RENDER_RADIUS * depthScale
  const radius = Math.max(0.7, EARTH_RENDER_RADIUS - scaledDepth)

  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon),
  )
}

type WaypointLookup = Record<string, Waypoint>

export function getSegmentPositions(
  segment: RouteSegment,
  waypointsById: WaypointLookup = waypointById,
) {
  const from = waypointsById[segment.from].position
  const to = waypointsById[segment.to].position
  return [from, ...(segment.path ?? []), to]
}

export function sampleRoutePositions(positions: Position[], samplesPerLeg = 10) {
  const sampled: Position[] = []

  for (let index = 0; index < positions.length - 1; index += 1) {
    const from = positions[index]
    const to = positions[index + 1]

    for (let step = 0; step < samplesPerLeg; step += 1) {
      sampled.push(interpolatePosition(from, to, step / samplesPerLeg))
    }
  }

  sampled.push(positions[positions.length - 1])
  return sampled
}

export function getSegmentRenderPoints(
  segment: RouteSegment,
  depthScale: number,
  waypointsById: WaypointLookup = waypointById,
) {
  return sampleRoutePositions(getSegmentPositions(segment, waypointsById)).map((position) =>
    positionToVector3(position, depthScale),
  )
}

export function getSegmentDistanceKm(
  segment: RouteSegment,
  waypointsById: WaypointLookup = waypointById,
) {
  if (typeof segment.distanceKm === 'number') {
    return segment.distanceKm
  }

  const positions = getSegmentPositions(segment, waypointsById)
  return positions.reduce((total, position, index) => {
    if (index === 0) {
      return total
    }

    return total + haversineDistanceKm(positions[index - 1], position)
  }, 0)
}

export function getCumulativeDistanceKm(
  segments: RouteSegment[],
  waypointsById: WaypointLookup = waypointById,
) {
  return segments.reduce(
    (total, segment) => total + getSegmentDistanceKm(segment, waypointsById),
    0,
  )
}

export function formatDistance(km: number) {
  if (km >= 1000) {
    return `${Math.round(km).toLocaleString()} km`
  }

  if (km >= 10) {
    return `${Math.round(km)} km`
  }

  return `${km.toFixed(1)} km`
}
