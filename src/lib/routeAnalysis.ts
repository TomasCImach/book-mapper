import * as THREE from 'three'
import {
  chapterLocationFactByNumber,
  getChapterLocationFactByNumber,
  type ChapterLocationFact,
} from '../data/chapterLocationFacts'
import {
  currentBookModel,
  routeSegments,
  type BookModel,
  type Position,
  type RouteSegment,
} from '../data/journey'
import {
  EARTH_RADIUS_KM,
  getSegmentDistanceKm,
  getSegmentPositions,
  haversineDistanceKm,
  toRadians,
} from './geo'

export type XyzDeltaKm = {
  x: number
  y: number
  z: number
}

export type SegmentRouteAnalysis = {
  segment: RouteSegment
  distanceKm: number
  horizontalDistanceKm: number
  depthDeltaKm: number
  slopeAngleDegrees: number
  gradePercent: number | null
  xyzDeltaKm: XyzDeltaKm
  straightLineKm: number
}

export type ChapterRouteAnalysis = {
  fact: ChapterLocationFact
  segments: SegmentRouteAnalysis[]
  distanceKm: number
  horizontalDistanceKm: number
  depthDeltaKm: number
  slopeAngleDegrees: number | null
  gradePercent: number | null
  xyzDeltaKm: XyzDeltaKm
}

const routeSegmentById = Object.fromEntries(
  routeSegments.map((segment) => [segment.id, segment]),
) as Record<string, RouteSegment>

function positionToEarthKmVector3(position: Position) {
  const lat = toRadians(position.lat)
  const lon = toRadians(position.lon)
  const radius = EARTH_RADIUS_KM - (position.depthKm ?? 0)

  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon),
  )
}

function getPathHorizontalDistanceKm(positions: Position[]) {
  return positions.reduce((total, position, index) => {
    if (index === 0) {
      return total
    }

    return total + haversineDistanceKm(positions[index - 1], position)
  }, 0)
}

export function analyzeSegment(
  segment: RouteSegment,
  model: BookModel = currentBookModel,
): SegmentRouteAnalysis {
  const positions = getSegmentPositions(segment, model.waypointById)
  const start = positions[0]
  const end = positions[positions.length - 1]
  const startVector = positionToEarthKmVector3(start)
  const endVector = positionToEarthKmVector3(end)
  const delta = endVector.sub(startVector)
  const distanceKm = getSegmentDistanceKm(segment, model.waypointById)
  const horizontalDistanceKm = getPathHorizontalDistanceKm(positions)
  const depthDeltaKm = (end.depthKm ?? 0) - (start.depthKm ?? 0)
  const slopeAngleDegrees =
    horizontalDistanceKm === 0
      ? depthDeltaKm === 0
        ? 0
        : Math.sign(depthDeltaKm) * 90
      : (Math.atan2(depthDeltaKm, horizontalDistanceKm) * 180) / Math.PI
  const gradePercent =
    horizontalDistanceKm === 0 ? null : (depthDeltaKm / horizontalDistanceKm) * 100

  return {
    segment,
    distanceKm,
    horizontalDistanceKm,
    depthDeltaKm,
    slopeAngleDegrees,
    gradePercent,
    xyzDeltaKm: {
      x: delta.x,
      y: delta.y,
      z: delta.z,
    },
    straightLineKm: delta.length(),
  }
}

export function getChapterRouteAnalysis(
  chapter: number,
  model: BookModel = currentBookModel,
): ChapterRouteAnalysis {
  const fact =
    model === currentBookModel
      ? chapterLocationFactByNumber[chapter]
      : getChapterLocationFactByNumber(model.book)[chapter]
  const activeRouteSegmentById =
    model === currentBookModel
      ? routeSegmentById
      : (Object.fromEntries(
          model.routeSegments.map((segment) => [segment.id, segment]),
        ) as Record<string, RouteSegment>)
  const segments = fact.segmentIds
    .map((segmentId) => activeRouteSegmentById[segmentId])
    .filter(Boolean)
    .map((segment) => analyzeSegment(segment, model))
  const xyzDeltaKm = segments.reduce<XyzDeltaKm>(
    (total, analysis) => ({
      x: total.x + analysis.xyzDeltaKm.x,
      y: total.y + analysis.xyzDeltaKm.y,
      z: total.z + analysis.xyzDeltaKm.z,
    }),
    { x: 0, y: 0, z: 0 },
  )
  const distanceKm = segments.reduce((total, analysis) => total + analysis.distanceKm, 0)
  const horizontalDistanceKm = segments.reduce(
    (total, analysis) => total + analysis.horizontalDistanceKm,
    0,
  )
  const depthDeltaKm = segments.reduce(
    (total, analysis) => total + analysis.depthDeltaKm,
    0,
  )
  const slopeAngleDegrees =
    segments.length === 0
      ? null
      : horizontalDistanceKm === 0
        ? depthDeltaKm === 0
          ? 0
          : Math.sign(depthDeltaKm) * 90
        : (Math.atan2(depthDeltaKm, horizontalDistanceKm) * 180) / Math.PI
  const gradePercent =
    segments.length === 0 || horizontalDistanceKm === 0
      ? null
      : (depthDeltaKm / horizontalDistanceKm) * 100

  return {
    fact,
    segments,
    distanceKm,
    horizontalDistanceKm,
    depthDeltaKm,
    slopeAngleDegrees,
    gradePercent,
    xyzDeltaKm,
  }
}

export function formatDepthDelta(km: number) {
  if (Math.abs(km) < 0.05) {
    return '0 km'
  }

  const direction = km > 0 ? 'down' : 'up'
  return `${Math.abs(km).toFixed(Math.abs(km) < 10 ? 1 : 0)} km ${direction}`
}

export function formatSlope(angle: number | null, gradePercent: number | null) {
  if (angle === null) {
    return 'none'
  }

  const angleLabel = `${angle.toFixed(Math.abs(angle) < 10 ? 1 : 0)} deg`

  if (gradePercent === null) {
    return angle === 0 ? 'flat' : `${angleLabel} vertical`
  }

  if (Math.abs(gradePercent) < 0.1) {
    return `${angleLabel} / flat`
  }

  return `${angleLabel} / ${gradePercent.toFixed(Math.abs(gradePercent) < 10 ? 1 : 0)}%`
}

export function formatXyzDelta(delta: XyzDeltaKm) {
  const formatAxis = (value: number) =>
    `${value >= 0 ? '+' : ''}${Math.round(value).toLocaleString()}`

  return `x ${formatAxis(delta.x)}, y ${formatAxis(delta.y)}, z ${formatAxis(delta.z)} km`
}

export function validateChapterRouteAnalysis(model: BookModel = currentBookModel) {
  const errors: string[] = []
  const activeFactByNumber =
    model === currentBookModel
      ? chapterLocationFactByNumber
      : getChapterLocationFactByNumber(model.book)
  const activeRouteSegmentById =
    model === currentBookModel
      ? routeSegmentById
      : (Object.fromEntries(
          model.routeSegments.map((segment) => [segment.id, segment]),
        ) as Record<string, RouteSegment>)

  for (const fact of Object.values(activeFactByNumber)) {
    for (const segmentId of fact.segmentIds) {
      if (!activeRouteSegmentById[segmentId]) {
        errors.push(`Chapter ${fact.chapter} references missing segment ${segmentId}`)
      }
    }
  }

  return errors
}
