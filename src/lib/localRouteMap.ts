import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import {
  getCurrentChapterSegments,
  getVisibleSegments,
  type BookModel,
  type RouteSegment,
  type Waypoint,
} from '../data/journey'
import { getSegmentPositions } from './geo'
import { getRouteViewportProfile, type RouteViewportMode } from './routeViewport'

export type LocalRouteLineProperties = {
  segmentId: string
  title: string
  medium: string
  color: string
  active: boolean
  current: boolean
}

export type LocalWaypointProperties = {
  waypointId: string
  name: string
  active: boolean
  current: boolean
  showLabel: boolean
}

export type LocalRouteBounds = [number, number, number, number]

export type LocalRouteMapData = {
  mode: Exclude<RouteViewportMode, 'global'>
  routeFeatures: FeatureCollection<LineString, LocalRouteLineProperties>
  waypointFeatures: FeatureCollection<Point, LocalWaypointProperties>
  bounds: LocalRouteBounds | null
  center: [number, number]
  selectedSegment: RouteSegment | null
}

type Coordinate = [number, number]

function positionToCoordinate(position: { lat: number; lon: number }): Coordinate {
  return [position.lon, position.lat]
}

function extendBounds(bounds: LocalRouteBounds | null, coordinate: Coordinate) {
  if (!bounds) {
    return [coordinate[0], coordinate[1], coordinate[0], coordinate[1]] as LocalRouteBounds
  }

  return [
    Math.min(bounds[0], coordinate[0]),
    Math.min(bounds[1], coordinate[1]),
    Math.max(bounds[2], coordinate[0]),
    Math.max(bounds[3], coordinate[1]),
  ] as LocalRouteBounds
}

function getSegmentCoordinates(
  segment: RouteSegment,
  waypointById: BookModel['waypointById'],
): Coordinate[] {
  return getSegmentPositions(segment, waypointById).map(positionToCoordinate)
}

function getSelectedSegment(
  visibleSegments: RouteSegment[],
  selectedSegmentId: string,
) {
  return (
    visibleSegments.find((segment) => segment.id === selectedSegmentId) ??
    visibleSegments[visibleSegments.length - 1] ??
    null
  )
}

function getWaypointIds(segments: RouteSegment[]) {
  const ids = new Set<string>()

  for (const segment of segments) {
    ids.add(segment.from)
    ids.add(segment.to)
  }

  return ids
}

function shouldLabelWaypoint(
  waypoint: Waypoint,
  visibleWaypointIds: Set<string>,
  currentWaypointIds: Set<string>,
  activeWaypointIds: Set<string>,
  mode: Exclude<RouteViewportMode, 'global'>,
) {
  if (mode === 'city') {
    return (
      visibleWaypointIds.size <= 4 ||
      currentWaypointIds.has(waypoint.id) ||
      activeWaypointIds.has(waypoint.id)
    )
  }

  return currentWaypointIds.has(waypoint.id) || activeWaypointIds.has(waypoint.id)
}

export function getLocalRouteMapData(
  model: BookModel,
  chapter: number,
  selectedSegmentId: string,
): LocalRouteMapData | null {
  const profile = getRouteViewportProfile(model)

  if (!profile.isLocal) {
    return null
  }

  const mode = profile.mode as Exclude<RouteViewportMode, 'global'>
  const visibleSegments = getVisibleSegments(chapter, model.routeSegments)
  const currentSegments = getCurrentChapterSegments(chapter, model.routeSegments)
  const selectedSegment = getSelectedSegment(visibleSegments, selectedSegmentId)
  const currentSegmentIds = new Set(currentSegments.map((segment) => segment.id))
  const visibleWaypointIds = getWaypointIds(visibleSegments)
  const currentWaypointIds = getWaypointIds(currentSegments)
  const activeWaypointIds = new Set<string>()
  let bounds: LocalRouteBounds | null = null

  for (const waypoint of model.waypoints) {
    if (waypoint.chapter <= chapter) {
      visibleWaypointIds.add(waypoint.id)
    }
  }

  if (selectedSegment) {
    activeWaypointIds.add(selectedSegment.from)
    activeWaypointIds.add(selectedSegment.to)
  }

  const routeFeatures = visibleSegments.map((segment) => {
    const coordinates = getSegmentCoordinates(segment, model.waypointById)

    for (const coordinate of coordinates) {
      bounds = extendBounds(bounds, coordinate)
    }

    return {
      type: 'Feature',
      properties: {
        segmentId: segment.id,
        title: segment.title,
        medium: segment.medium,
        color: model.mediumColors[segment.medium] ?? '#68c6b5',
        active: segment.id === selectedSegment?.id,
        current: currentSegmentIds.has(segment.id),
      },
      geometry: {
        type: 'LineString',
        coordinates,
      },
    } satisfies Feature<LineString, LocalRouteLineProperties>
  })

  const waypointFeatures = model.waypoints
    .filter((waypoint) => visibleWaypointIds.has(waypoint.id))
    .map((waypoint) => {
      const coordinate = positionToCoordinate(waypoint.position)

      bounds = extendBounds(bounds, coordinate)

      return {
        type: 'Feature',
        properties: {
          waypointId: waypoint.id,
          name: waypoint.name,
          active: activeWaypointIds.has(waypoint.id),
          current: currentWaypointIds.has(waypoint.id),
          showLabel: shouldLabelWaypoint(
            waypoint,
            visibleWaypointIds,
            currentWaypointIds,
            activeWaypointIds,
            mode,
          ),
        },
        geometry: {
          type: 'Point',
          coordinates: coordinate,
        },
      } satisfies Feature<Point, LocalWaypointProperties>
    })

  return {
    mode,
    routeFeatures: {
      type: 'FeatureCollection',
      features: routeFeatures,
    },
    waypointFeatures: {
      type: 'FeatureCollection',
      features: waypointFeatures,
    },
    bounds,
    center: [profile.center.lon, profile.center.lat],
    selectedSegment,
  }
}
