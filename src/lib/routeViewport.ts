import * as THREE from 'three'
import type { BookModel, Position, RouteSegment, Waypoint } from '../data/journey'
import {
  EARTH_RADIUS_KM,
  EARTH_RENDER_RADIUS,
  getSegmentPositions,
  haversineDistanceKm,
  positionToVector3,
  sampleRoutePositions,
  toDegrees,
  toRadians,
} from './geo'

export type RouteViewportMode = 'global' | 'country' | 'city'

export type RouteViewportProfile = {
  mode: RouteViewportMode
  isLocal: boolean
  center: Position
  extentKm: number
  renderKmScale: number
  minCameraDistance: number
  maxCameraDistance: number
  homeCameraDistance: number
  focusMaxDistance: number
  surfaceOffset: number
  surfaceNormal: THREE.Vector3
  east: THREE.Vector3
  north: THREE.Vector3
  centerVector: THREE.Vector3
}

const CITY_EXTENT_KM = 80
const COUNTRY_EXTENT_KM = 350
const LOCAL_SURFACE_OFFSET = 0.045

type WaypointLookup = Record<string, Waypoint>

function getRoutePositions(model: BookModel) {
  const positions = model.routeSegments.flatMap((segment) =>
    getSegmentPositions(segment, model.waypointById),
  )

  return positions.length > 0
    ? positions
    : model.waypoints.map((waypoint) => waypoint.position)
}

function getRouteExtentKm(positions: Position[]) {
  let extentKm = 0

  for (let index = 0; index < positions.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < positions.length; nextIndex += 1) {
      extentKm = Math.max(
        extentKm,
        haversineDistanceKm(positions[index], positions[nextIndex]),
      )
    }
  }

  return extentKm
}

function classifyRouteExtent(extentKm: number): RouteViewportMode {
  if (extentKm <= CITY_EXTENT_KM) {
    return 'city'
  }

  if (extentKm <= COUNTRY_EXTENT_KM) {
    return 'country'
  }

  return 'global'
}

function vectorToPosition(vector: THREE.Vector3): Position {
  const radius = Math.max(vector.length(), 0.0001)

  return {
    lat: toDegrees(Math.asin(vector.y / radius)),
    lon: toDegrees(Math.atan2(-vector.z, vector.x)),
  }
}

function getRouteCenter(positions: Position[]): Position {
  const center = positions.reduce(
    (total, position) => total.add(positionToVector3(position, 1).normalize()),
    new THREE.Vector3(),
  )

  if (center.lengthSq() < 0.0001) {
    return positions[0] ?? { lat: 0, lon: 0 }
  }

  return vectorToPosition(center.normalize())
}

function getLocalAxes(center: Position) {
  const lat = toRadians(center.lat)
  const lon = toRadians(center.lon)
  const surfaceNormal = positionToVector3(center, 1).normalize()
  const east = new THREE.Vector3(-Math.sin(lon), 0, -Math.cos(lon)).normalize()
  const north = new THREE.Vector3(
    -Math.sin(lat) * Math.cos(lon),
    Math.cos(lat),
    Math.sin(lat) * Math.sin(lon),
  ).normalize()

  return { surfaceNormal, east, north }
}

export function getRouteViewportProfile(model: BookModel): RouteViewportProfile {
  const positions = getRoutePositions(model)
  const extentKm = getRouteExtentKm(positions)
  const mode = classifyRouteExtent(extentKm)
  const isLocal = mode !== 'global'
  const center = getRouteCenter(positions)
  const axes = getLocalAxes(center)
  const surfaceOffset = isLocal ? LOCAL_SURFACE_OFFSET : 0
  const centerVector = axes.surfaceNormal
    .clone()
    .multiplyScalar(EARTH_RENDER_RADIUS + surfaceOffset)
  const renderKmScale = EARTH_RENDER_RADIUS / EARTH_RADIUS_KM

  return {
    mode,
    isLocal,
    center,
    extentKm,
    renderKmScale,
    minCameraDistance: mode === 'city' ? 0.38 : mode === 'country' ? 0.75 : 7,
    maxCameraDistance: isLocal ? 12 : 36,
    homeCameraDistance: mode === 'city' ? 0.78 : mode === 'country' ? 1.15 : 14,
    focusMaxDistance: isLocal ? 12 : 36,
    surfaceOffset,
    surfaceNormal: axes.surfaceNormal,
    east: axes.east,
    north: axes.north,
    centerVector,
  }
}

export function projectRoutePosition(
  position: Position,
  depthScale: number,
  profile: RouteViewportProfile,
) {
  if (!profile.isLocal) {
    return positionToVector3(position, depthScale)
  }

  const surfacePosition = positionToVector3(position, depthScale)
  const surfaceNormal = positionToVector3(
    { lat: position.lat, lon: position.lon },
    1,
  ).normalize()

  return surfacePosition.add(surfaceNormal.multiplyScalar(profile.surfaceOffset))
}

export function getViewportSegmentRenderPoints(
  segment: RouteSegment,
  depthScale: number,
  waypointsById: WaypointLookup,
  profile: RouteViewportProfile,
) {
  return sampleRoutePositions(getSegmentPositions(segment, waypointsById)).map(
    (position) => projectRoutePosition(position, depthScale, profile),
  )
}
