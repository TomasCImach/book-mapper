import { useEffect, useMemo, useRef } from 'react'
import maplibregl, {
  type GeoJSONSource,
  type Map as MapLibreMap,
  type MapLayerMouseEvent,
  type PaddingOptions,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  getBookModel,
  type BookModel,
  type RouteSegment,
} from '../data/journey'
import { getSegmentDistanceKm } from '../lib/geo'
import {
  getLocalRouteMapData,
  type LocalRouteMapData,
} from '../lib/localRouteMap'
import { trackEvent } from '../lib/analytics'
import { useMapStore } from '../store/mapStore'

const LOCAL_MAP_STYLE_URL =
  import.meta.env.VITE_MAPLIBRE_STYLE_URL ??
  'https://tiles.openfreemap.org/styles/positron'

const ROUTE_SOURCE_ID = 'book-local-route-lines'
const WAYPOINT_SOURCE_ID = 'book-local-route-waypoints'
const ROUTE_CASING_LAYER_ID = 'book-local-route-casing'
const ROUTE_LINE_LAYER_ID = 'book-local-route-line'
const ROUTE_ACTIVE_LAYER_ID = 'book-local-route-active'
const WAYPOINT_CIRCLE_LAYER_ID = 'book-local-waypoint-circle'
const WAYPOINT_ACTIVE_LAYER_ID = 'book-local-waypoint-active'
const WAYPOINT_LABEL_LAYER_ID = 'book-local-waypoint-label'

const ROUTE_CLICK_LAYERS = [ROUTE_ACTIVE_LAYER_ID, ROUTE_LINE_LAYER_ID]

type LocalRouteSnapshot = {
  bookModel: BookModel
  selectedChapter: number
}

function getOverlayRect(selector: string) {
  return document.querySelector<HTMLElement>(selector)?.getBoundingClientRect()
}

function rectsIntersect(a: DOMRect, b: DOMRect) {
  return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom
}

function getLocalMapPadding(container: HTMLElement): PaddingOptions {
  const containerRect = container.getBoundingClientRect()
  const isMobile = containerRect.width <= 560
  const padding: PaddingOptions = {
    top: isMobile ? 72 : 46,
    right: isMobile ? 68 : 46,
    bottom: 46,
    left: isMobile ? 82 : 46,
  }
  const mapUiRect = getOverlayRect('.map-ui')
  const contextPanelRect = getOverlayRect('.context-panel')

  if (mapUiRect && rectsIntersect(containerRect, mapUiRect)) {
    const isLeftRail =
      mapUiRect.left <= containerRect.left + 48 &&
      mapUiRect.height > containerRect.height * 0.48
    const isBottomSheet =
      mapUiRect.bottom >= containerRect.bottom - 48 &&
      mapUiRect.width > containerRect.width * 0.6

    if (isLeftRail) {
      padding.left = Math.max(
        padding.left ?? 0,
        mapUiRect.right - containerRect.left + 72,
      )
    }

    if (isBottomSheet) {
      padding.bottom = Math.max(
        padding.bottom ?? 0,
        containerRect.bottom - mapUiRect.top + 28,
      )
    }
  }

  if (contextPanelRect && rectsIntersect(containerRect, contextPanelRect)) {
    padding.top = Math.max(
      padding.top ?? 0,
      contextPanelRect.bottom - containerRect.top + 24,
    )
    padding.right = Math.max(
      padding.right ?? 0,
      containerRect.right - contextPanelRect.left + 28,
    )
  }

  return padding
}

function addLocalMapLayers(map: MapLibreMap, data: LocalRouteMapData) {
  if (!map.getSource(ROUTE_SOURCE_ID)) {
    map.addSource(ROUTE_SOURCE_ID, {
      type: 'geojson',
      data: data.routeFeatures,
    })
  }

  if (!map.getSource(WAYPOINT_SOURCE_ID)) {
    map.addSource(WAYPOINT_SOURCE_ID, {
      type: 'geojson',
      data: data.waypointFeatures,
    })
  }

  if (!map.getLayer(ROUTE_CASING_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_CASING_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#1a1712',
        'line-opacity': 0.72,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 5, 10, 8, 14, 13],
      },
    })
  }

  if (!map.getLayer(ROUTE_LINE_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_LINE_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-opacity': ['case', ['==', ['get', 'current'], true], 0.94, 0.66],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 3, 10, 5, 14, 9],
      },
    })
  }

  if (!map.getLayer(ROUTE_ACTIVE_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_ACTIVE_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      filter: ['==', ['get', 'active'], true],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-opacity': 1,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 5, 10, 8, 14, 12],
      },
    })
  }

  if (!map.getLayer(WAYPOINT_CIRCLE_LAYER_ID)) {
    map.addLayer({
      id: WAYPOINT_CIRCLE_LAYER_ID,
      type: 'circle',
      source: WAYPOINT_SOURCE_ID,
      paint: {
        'circle-color': '#fff7df',
        'circle-opacity': 0.94,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 10, 5, 14, 7],
        'circle-stroke-color': '#1a1712',
        'circle-stroke-width': 1.6,
      },
    })
  }

  if (!map.getLayer(WAYPOINT_ACTIVE_LAYER_ID)) {
    map.addLayer({
      id: WAYPOINT_ACTIVE_LAYER_ID,
      type: 'circle',
      source: WAYPOINT_SOURCE_ID,
      filter: ['any', ['==', ['get', 'active'], true], ['==', ['get', 'current'], true]],
      paint: {
        'circle-color': ['case', ['==', ['get', 'active'], true], '#ffcf5a', '#68c6b5'],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 6, 10, 8, 14, 11],
        'circle-stroke-color': '#1a1712',
        'circle-stroke-width': 2,
      },
    })
  }

  if (!map.getLayer(WAYPOINT_LABEL_LAYER_ID)) {
    map.addLayer({
      id: WAYPOINT_LABEL_LAYER_ID,
      type: 'symbol',
      source: WAYPOINT_SOURCE_ID,
      filter: ['==', ['get', 'showLabel'], true],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 11, 10, 12, 14, 14],
        'text-allow-overlap': false,
        'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
        'text-radial-offset': 0.9,
        'text-justify': 'auto',
      },
      paint: {
        'text-color': '#17120b',
        'text-halo-color': '#fff7df',
        'text-halo-width': 1.3,
      },
    })
  }
}

function updateLocalMapSources(map: MapLibreMap, data: LocalRouteMapData) {
  ;(map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource | undefined)?.setData(
    data.routeFeatures,
  )
  ;(map.getSource(WAYPOINT_SOURCE_ID) as GeoJSONSource | undefined)?.setData(
    data.waypointFeatures,
  )
}

function fitLocalMapToData(
  map: MapLibreMap,
  data: LocalRouteMapData,
  immediate: boolean,
) {
  if (!data.bounds) {
    map.easeTo({
      center: data.center,
      zoom: data.mode === 'city' ? 11.5 : 6.4,
      duration: immediate ? 0 : 500,
    })
    return
  }

  const [west, south, east, north] = data.bounds
  const maxZoom = data.mode === 'city' ? 14.2 : 8.6
  const samePoint = west === east && south === north

  if (samePoint) {
    map.easeTo({
      center: data.center,
      zoom: maxZoom,
      duration: immediate ? 0 : 500,
    })
    return
  }

  map.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    {
      padding: getLocalMapPadding(map.getContainer()),
      maxZoom,
      duration: immediate ? 0 : 650,
    },
  )
}

function trackRouteSelection(model: BookModel, segment: RouteSegment) {
  trackEvent('route_segment_selected', {
    book_id: model.book.id,
    book_title: model.book.title,
    segment_id: segment.id,
    segment_title: segment.title,
    chapter_start: segment.chapterStart,
    chapter_end: segment.chapterEnd,
    medium: segment.medium,
    medium_label: model.mediumLabels[segment.medium],
    distance_km: Math.round(getSegmentDistanceKm(segment, model.waypointById) * 100) / 100,
    method: 'local_map_line',
  })
}

export function LocalRouteMapScene() {
  const selectedBookId = useMapStore((state) => state.selectedBookId)
  const selectedChapter = useMapStore((state) => state.selectedChapter)
  const selectedSegmentId = useMapStore((state) => state.selectedSegmentId)
  const setSelectedSegmentId = useMapStore((state) => state.setSelectedSegmentId)
  const bookModel = useMemo(() => getBookModel(selectedBookId), [selectedBookId])
  const mapData = useMemo(
    () => getLocalRouteMapData(bookModel, selectedChapter, selectedSegmentId),
    [bookModel, selectedChapter, selectedSegmentId],
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const loadedRef = useRef(false)
  const fitKeyRef = useRef('')
  const mapDataRef = useRef<LocalRouteMapData | null>(mapData)
  const latestSnapshotRef = useRef<LocalRouteSnapshot>({
    bookModel,
    selectedChapter,
  })

  useEffect(() => {
    mapDataRef.current = mapData
    latestSnapshotRef.current = { bookModel, selectedChapter }
  }, [bookModel, mapData, selectedChapter])

  useEffect(() => {
    document.documentElement.classList.add('local-map-active')

    return () => document.documentElement.classList.remove('local-map-active')
  }, [])

  useEffect(() => {
    const container = containerRef.current
    const initialData = mapDataRef.current

    if (!container || !initialData) {
      return undefined
    }

    const map = new maplibregl.Map({
      container,
      style: LOCAL_MAP_STYLE_URL,
      center: initialData.center,
      zoom: initialData.mode === 'city' ? 11.5 : 6.4,
      bearing: 0,
      pitch: 0,
      attributionControl: { compact: true },
    })

    mapRef.current = map
    map.dragRotate.disable()
    map.touchZoomRotate.disableRotation()
    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
        showZoom: true,
        visualizePitch: false,
      }),
      'top-right',
    )

    function handleRouteClick(event: MapLayerMouseEvent) {
      const segmentId = event.features?.[0]?.properties?.segmentId

      if (typeof segmentId !== 'string') {
        return
      }

      const { bookModel: currentModel } = latestSnapshotRef.current
      const segment = currentModel.routeSegments.find(
        (routeSegment) => routeSegment.id === segmentId,
      )

      if (!segment) {
        return
      }

      setSelectedSegmentId(segment.id)
      trackRouteSelection(currentModel, segment)
    }

    function handleMouseEnter() {
      map.getCanvas().style.cursor = 'pointer'
    }

    function handleMouseLeave() {
      map.getCanvas().style.cursor = ''
    }

    map.on('load', () => {
      const currentData = mapDataRef.current

      if (!currentData) {
        return
      }

      loadedRef.current = true
      addLocalMapLayers(map, currentData)
      updateLocalMapSources(map, currentData)
      fitLocalMapToData(map, currentData, true)
      fitKeyRef.current = `${latestSnapshotRef.current.bookModel.book.id}:${latestSnapshotRef.current.selectedChapter}:${currentData.bounds?.join(',') ?? 'empty'}`

      for (const layerId of ROUTE_CLICK_LAYERS) {
        map.on('click', layerId, handleRouteClick)
        map.on('mouseenter', layerId, handleMouseEnter)
        map.on('mouseleave', layerId, handleMouseLeave)
      }
    })

    map.on('error', (event) => {
      console.warn('Local map render error', event.error)
    })

    return () => {
      loadedRef.current = false
      mapRef.current = null
      map.remove()
    }
  }, [setSelectedSegmentId])

  useEffect(() => {
    const map = mapRef.current

    if (!map || !loadedRef.current || !mapData) {
      return
    }

    addLocalMapLayers(map, mapData)
    updateLocalMapSources(map, mapData)

    const nextFitKey = `${bookModel.book.id}:${selectedChapter}:${mapData.bounds?.join(',') ?? 'empty'}`

    if (fitKeyRef.current !== nextFitKey) {
      fitKeyRef.current = nextFitKey
      fitLocalMapToData(map, mapData, false)
    }
  }, [bookModel.book.id, mapData, selectedChapter])

  useEffect(() => {
    const map = mapRef.current

    if (!map || !mapData) {
      return undefined
    }

    const resizeObserver = new ResizeObserver(() => {
      map.resize()
      fitLocalMapToData(map, mapData, true)
    })

    resizeObserver.observe(map.getContainer())

    return () => resizeObserver.disconnect()
  }, [mapData])

  return (
    <section className="map-stage local-map-stage" aria-label="Interactive local title map">
      <div ref={containerRef} className="local-map-container" />
    </section>
  )
}
