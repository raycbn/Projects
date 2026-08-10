import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import { setWorkerUrl } from 'maplibre-gl'
import type { Map, MapMouseEvent, Marker } from 'maplibre-gl'
import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import type { LatLng, RouteGeometry, Waypoint } from '@/domain/types'
import { getMapStyleUrl } from '@/lib/mapTiles'

/**
 * Vite bundles MapLibre into a chunk, so its relative worker URL breaks
 * (browser receives index.html instead of the worker). Point at the files
 * copied into dist/assets by vite.config.ts.
 */
setWorkerUrl(`${import.meta.env.BASE_URL}assets/maplibre-gl-worker.mjs`)

const STYLE_URL = getMapStyleUrl()

/** Discrete wind colors — match() on string props is more reliable than float interpolate. */
const WIND_COLOR_EXPR: maplibregl.ExpressionSpecification = [
  'match',
  ['get', 'relative'],
  'cola',
  '#16a34a',
  'cara',
  '#ea580c',
  /* lateral */ '#0284c7',
]

interface MapViewProps {
  waypoints: Waypoint[]
  geometry?: RouteGeometry | null
  hoverPoint?: LatLng | null
  /** Wind overlay along the route (segments + arrows) for a selected hour/window. */
  windOverlay?: FeatureCollection | null
  windCaption?: string | null
  /** Surface-colored segments (paved / unpaved / unknown). */
  surfaceOverlay?: FeatureCollection | null
  showUserLocation?: LatLng | null
  /** Keep the camera on the user (navigation / recording). */
  followUser?: boolean
  interactive?: boolean
  onMapClick?: (position: LatLng) => void
  onWaypointDrag?: (id: string, position: LatLng) => void
  className?: string
  fitKey?: string
}

const SURFACE_COLOR_EXPR: maplibregl.ExpressionSpecification = [
  'match',
  ['get', 'kind'],
  'paved',
  '#0d3b2b',
  'unpaved',
  '#8b5a2b',
  /* unknown */ '#94a3b8',
]

function ensureRouteLayers(map: Map) {
  if (!map.getSource('route')) {
    map.addSource('route', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
  }

  if (!map.getLayer('route-line-casing')) {
    map.addLayer({
      id: 'route-line-casing',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#04140e',
        'line-width': 12,
        'line-opacity': 0.55,
      },
    })
  }

  if (!map.getLayer('route-line')) {
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#d6ff4b',
        'line-width': 6,
        'line-opacity': 1,
      },
    })
  }
}

function ensureSurfaceLayers(map: Map) {
  if (!map.getSource('route-surface')) {
    map.addSource('route-surface', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
  }
  if (!map.getLayer('route-surface-line')) {
    map.addLayer({
      id: 'route-surface-line',
      type: 'line',
      source: 'route-surface',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': SURFACE_COLOR_EXPR,
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8,
          5,
          12,
          8,
          15,
          12,
        ],
        'line-opacity': 0.95,
      },
    })
  }
}

function applySurfaceOverlay(map: Map, overlay: FeatureCollection | null | undefined) {
  if (!map.isStyleLoaded()) return false
  ensureRouteLayers(map)
  ensureSurfaceLayers(map)
  const source = map.getSource('route-surface') as maplibregl.GeoJSONSource | undefined
  if (!source) return false
  const hasSurface = Boolean(overlay?.features?.length)
  source.setData(overlay ?? { type: 'FeatureCollection', features: [] })
  if (map.getLayer('route-line')) {
    map.setPaintProperty('route-line', 'line-opacity', hasSurface ? 0.15 : 1)
    map.setPaintProperty('route-line', 'line-width', hasSurface ? 3 : 6)
  }
  if (map.getLayer('route-surface-line')) map.moveLayer('route-surface-line')
  return true
}

function createWindArrowImage(
  fill: string,
): { data: Uint8Array; width: number; height: number } {
  const width = 128
  const height = 128
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return { data: new Uint8Array(width * height * 4), width, height }
  }
  ctx.clearRect(0, 0, width, height)
  ctx.translate(width / 2, height / 2)
  // Halo for contrast on any segment color
  ctx.beginPath()
  ctx.arc(0, 0, 36, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fill()
  // Arrow tip points UP (north). With icon-rotation-alignment:map, rotate = bearing.
  ctx.beginPath()
  ctx.moveTo(0, -38)
  ctx.lineTo(22, 28)
  ctx.lineTo(0, 14)
  ctx.lineTo(-22, 28)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 5
  ctx.strokeStyle = '#04140e'
  ctx.stroke()
  const imageData = ctx.getImageData(0, 0, width, height)
  return { data: new Uint8Array(imageData.data), width, height }
}

const WIND_ARROW_IMAGES: Record<string, string> = {
  'wind-arrow-cola': '#16a34a',
  'wind-arrow-lateral': '#0284c7',
  'wind-arrow-cara': '#ea580c',
}

function ensureWindArrowImages(map: Map) {
  for (const [id, fill] of Object.entries(WIND_ARROW_IMAGES)) {
    if (map.hasImage(id)) {
      try {
        map.removeImage(id)
      } catch {
        /* ignore */
      }
    }
    const img = createWindArrowImage(fill)
    map.addImage(id, img, { pixelRatio: 2 })
  }
}

function removeLayerIfExists(map: Map, id: string) {
  if (map.getLayer(id)) map.removeLayer(id)
}

/**
 * Wind visuals use dedicated sources so Point + LineString never share a bucket,
 * and segment colors use discrete match() (not float interpolate).
 */
function ensureWindLayers(map: Map) {
  ensureWindArrowImages(map)

  if (!map.getSource('route-wind-lines')) {
    map.addSource('route-wind-lines', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
  }
  if (!map.getSource('route-wind-points')) {
    map.addSource('route-wind-points', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
  }

  if (!map.getLayer('route-wind-segments')) {
    map.addLayer({
      id: 'route-wind-segments',
      type: 'line',
      source: 'route-wind-lines',
      filter: ['==', ['get', 'kind'], 'segment'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8,
          7,
          12,
          11,
          15,
          16,
        ],
        'line-opacity': 1,
        'line-color': WIND_COLOR_EXPR,
      },
    })
  }

  if (!map.getLayer('route-wind-barbs')) {
    map.addLayer({
      id: 'route-wind-barbs',
      type: 'line',
      source: 'route-wind-lines',
      minzoom: 11,
      filter: ['==', ['get', 'kind'], 'barb'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-width': 4.5,
        'line-opacity': 1,
        'line-color': WIND_COLOR_EXPR,
      },
    })
  }

  if (!map.getLayer('route-wind-arrows')) {
    map.addLayer({
      id: 'route-wind-arrows',
      type: 'symbol',
      source: 'route-wind-points',
      minzoom: 10.5,
      filter: ['==', ['get', 'kind'], 'arrow'],
      layout: {
        'icon-image': [
          'match',
          ['get', 'relative'],
          'cola',
          'wind-arrow-cola',
          'cara',
          'wind-arrow-cara',
          'wind-arrow-lateral',
        ],
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          9,
          0.45,
          12,
          0.7,
          15,
          0.9,
        ],
        'icon-rotate': ['get', 'windTowardDeg'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-padding': 0,
      },
      paint: {
        'icon-opacity': 1,
      },
    })
  }

  if (!map.getLayer('route-wind-labels')) {
    map.addLayer({
      id: 'route-wind-labels',
      type: 'symbol',
      source: 'route-wind-points',
      minzoom: 12,
      filter: [
        'all',
        ['==', ['get', 'kind'], 'arrow'],
        ['!=', ['get', 'legLabel'], ''],
      ],
      layout: {
        'text-field': ['get', 'legLabel'],
        'text-size': 11,
        'text-offset': [0, 1.85],
        'text-anchor': 'top',
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#0d3b2b',
        'text-halo-color': 'rgba(255,255,255,0.95)',
        'text-halo-width': 1.8,
      },
    })
  }

  for (const id of [
    'route-wind-segments',
    'route-wind-barbs',
    'route-wind-arrows',
    'route-wind-labels',
  ]) {
    if (map.getLayer(id)) map.moveLayer(id)
  }
}

function setBaseRoutePaint(map: Map, windActive: boolean) {
  if (map.getLayer('route-line')) {
    if (windActive) {
      // Hide lime base — wind segments become the visible route color
      map.setPaintProperty('route-line', 'line-opacity', 0)
      map.setPaintProperty('route-line', 'line-width', 2)
    } else {
      map.setPaintProperty('route-line', 'line-color', '#d6ff4b')
      map.setPaintProperty('route-line', 'line-opacity', 1)
      map.setPaintProperty('route-line', 'line-width', 6)
    }
  }
  if (map.getLayer('route-line-casing')) {
    map.setPaintProperty('route-line-casing', 'line-opacity', windActive ? 0.15 : 0.55)
    map.setPaintProperty('route-line-casing', 'line-width', windActive ? 14 : 12)
  }
}

function applyGeometry(map: Map, geo: RouteGeometry | null | undefined, fit: boolean) {
  if (!map.isStyleLoaded()) return false

  ensureRouteLayers(map)
  ensureSurfaceLayers(map)
  ensureWindLayers(map)
  const source = map.getSource('route') as maplibregl.GeoJSONSource | undefined
  if (!source) return false

  if (!geo || geo.coordinates.length < 2) {
    source.setData({ type: 'FeatureCollection', features: [] })
    return true
  }

  source.setData({
    type: 'Feature',
    properties: {},
    geometry: geo,
  })

  if (fit) {
    const bounds = geo.coordinates.reduce(
      (b, c) => b.extend(c as [number, number]),
      new maplibregl.LngLatBounds(
        geo.coordinates[0] as [number, number],
        geo.coordinates[0] as [number, number],
      ),
    )
    map.fitBounds(bounds, { padding: 56, duration: 600 })
  }

  return true
}

function splitWindOverlay(overlay: FeatureCollection | null | undefined): {
  lines: FeatureCollection<LineString>
  points: FeatureCollection<Point>
  hasWind: boolean
} {
  const emptyLines: FeatureCollection<LineString> = { type: 'FeatureCollection', features: [] }
  const emptyPoints: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] }
  if (!overlay?.features?.length) {
    return { lines: emptyLines, points: emptyPoints, hasWind: false }
  }

  const lines: FeatureCollection<LineString> = { type: 'FeatureCollection', features: [] }
  const points: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] }

  for (const f of overlay.features) {
    if (!f.geometry) continue
    if (f.geometry.type === 'LineString') {
      lines.features.push(f as Feature<LineString>)
    } else if (f.geometry.type === 'Point') {
      points.features.push(f as Feature<Point>)
    }
  }

  return {
    lines,
    points,
    hasWind: lines.features.length > 0 || points.features.length > 0,
  }
}

function applyWindOverlay(map: Map, overlay: FeatureCollection | null | undefined) {
  if (!map.isStyleLoaded()) return false
  ensureRouteLayers(map)
  ensureWindLayers(map)

  const lineSource = map.getSource('route-wind-lines') as maplibregl.GeoJSONSource | undefined
  const pointSource = map.getSource('route-wind-points') as maplibregl.GeoJSONSource | undefined
  if (!lineSource || !pointSource) return false

  const { lines, points, hasWind } = splitWindOverlay(overlay)
  lineSource.setData(lines)
  pointSource.setData(points)
  setBaseRoutePaint(map, hasWind)
  if (map.getLayer('route-surface-line')) {
    map.setLayoutProperty('route-surface-line', 'visibility', hasWind ? 'none' : 'visible')
  }

  // Ensure wind stays on top after style/route updates
  for (const id of [
    'route-wind-segments',
    'route-wind-barbs',
    'route-wind-arrows',
    'route-wind-labels',
  ]) {
    if (map.getLayer(id)) map.moveLayer(id)
  }

  map.triggerRepaint()
  return true
}

/** Full rebuild of wind layers (recovers from style glitches / missing images). */
function rebuildWindLayers(map: Map) {
  for (const id of [
    'route-wind-labels',
    'route-wind-arrows',
    'route-wind-barbs',
    'route-wind-segments',
  ]) {
    removeLayerIfExists(map, id)
  }
  // Keep sources; only refresh images + layers
  ensureWindArrowImages(map)
  ensureWindLayers(map)
}

export function MapView({
  waypoints,
  geometry,
  hoverPoint,
  windOverlay,
  windCaption,
  surfaceOverlay,
  showUserLocation,
  followUser = false,
  interactive = true,
  onMapClick,
  onWaypointDrag,
  className,
  fitKey,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Map | null>(null)
  const markersRef = useRef<Marker[]>([])
  const hoverMarkerRef = useRef<Marker | null>(null)
  const userMarkerRef = useRef<Marker | null>(null)
  const followUserRef = useRef(followUser)
  const geometryRef = useRef<RouteGeometry | null | undefined>(geometry)
  const windRef = useRef<FeatureCollection | null | undefined>(windOverlay)
  const surfaceRef = useRef<FeatureCollection | null | undefined>(surfaceOverlay)
  const onMapClickRef = useRef(onMapClick)
  followUserRef.current = followUser
  geometryRef.current = geometry
  windRef.current = windOverlay
  surfaceRef.current = surfaceOverlay
  onMapClickRef.current = onMapClick

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [-3.7038, 40.4168],
      zoom: 10,
      attributionControl: { compact: true },
    })

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    map.addControl(new maplibregl.FullscreenControl(), 'top-right')
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      'top-right',
    )

    const paintFromRef = (fit: boolean) => {
      applyGeometry(map, geometryRef.current, fit)
      applySurfaceOverlay(map, surfaceRef.current)
      applyWindOverlay(map, windRef.current)
    }

    const resize = () => map.resize()

    map.on('load', () => {
      resize()
      requestAnimationFrame(() => {
        resize()
        paintFromRef(true)
      })
    })
    map.on('styledata', () => {
      if (map.isStyleLoaded()) {
        rebuildWindLayers(map)
        paintFromRef(Boolean(geometryRef.current))
      }
    })
    map.on('error', (e: { error?: Error }) => {
      console.error('[maplibre]', e.error ?? e)
    })

    const ro = new ResizeObserver(() => resize())
    ro.observe(containerRef.current)

    map.on('click', (e: MapMouseEvent) => {
      onMapClickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })

    mapRef.current = map
    return () => {
      ro.disconnect()
      markersRef.current.forEach((m) => m.remove())
      hoverMarkerRef.current?.remove()
      userMarkerRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    waypoints.forEach((wp) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.setAttribute('aria-label', wp.name || wp.kind)
      el.className =
        'h-4 w-4 rounded-full border-2 border-white shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-signal)]'
      el.style.background =
        wp.kind === 'start' ? '#d6ff4b' : wp.kind === 'end' ? '#0d3b2b' : '#2f9b6a'

      const marker = new maplibregl.Marker({
        element: el,
        draggable: Boolean(interactive && onWaypointDrag),
      })
        .setLngLat([wp.position.lng, wp.position.lat])
        .addTo(map)

      if (onWaypointDrag) {
        marker.on('dragend', () => {
          const lngLat = marker.getLngLat()
          onWaypointDrag(wp.id, { lat: lngLat.lat, lng: lngLat.lng })
        })
      }

      markersRef.current.push(marker)
    })
  }, [waypoints, interactive, onWaypointDrag])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    applyGeometry(map, geometry, Boolean(fitKey))
    applySurfaceOverlay(map, surfaceRef.current)
    applyWindOverlay(map, windRef.current)
  }, [geometry, fitKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    applySurfaceOverlay(map, surfaceOverlay)
  }, [surfaceOverlay])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (windOverlay?.features?.length) {
      rebuildWindLayers(map)
    }
    applyWindOverlay(map, windOverlay)
  }, [windOverlay])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!hoverPoint) {
      hoverMarkerRef.current?.remove()
      hoverMarkerRef.current = null
      return
    }

    if (!hoverMarkerRef.current) {
      const el = document.createElement('div')
      el.className = 'h-3 w-3 rounded-full bg-[var(--color-signal)] ring-2 ring-[var(--color-ink)]'
      hoverMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([hoverPoint.lng, hoverPoint.lat])
        .addTo(map)
    } else {
      hoverMarkerRef.current.setLngLat([hoverPoint.lng, hoverPoint.lat])
    }
  }, [hoverPoint])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!showUserLocation) {
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
      return
    }
    if (!userMarkerRef.current) {
      const el = document.createElement('div')
      el.className =
        'h-5 w-5 rounded-full bg-[#2563eb] ring-4 ring-[#2563eb]/40 border-2 border-white shadow-md'
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([showUserLocation.lng, showUserLocation.lat])
        .addTo(map)
    } else {
      userMarkerRef.current.setLngLat([showUserLocation.lng, showUserLocation.lat])
    }

    if (followUser) {
      map.resize()
      const zoom = Math.max(map.getZoom(), 15)
      map.easeTo({
        center: [showUserLocation.lng, showUserLocation.lat],
        zoom,
        duration: 650,
        essential: true,
      })
    }
  }, [showUserLocation, followUser])

  return (
    <div
      className={
        className
          ? `relative h-full min-h-[240px] w-full ${className}`
          : 'relative h-full min-h-[320px] w-full'
      }
    >
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full"
        role="application"
        aria-label="Mapa de rutas ciclistas"
      />
      {surfaceOverlay?.features?.length ? (
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex gap-2 rounded-xl bg-white/90 px-2 py-1.5 text-[10px] text-[var(--color-forest)] shadow ring-1 ring-[var(--color-fog)]">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-[var(--color-forest)]" /> Asfalto
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-[#8b5a2b]" /> Tierra
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-[#94a3b8]" /> ?
          </span>
        </div>
      ) : null}
      {windCaption && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[min(88%,16rem)] rounded-xl bg-white/90 px-2.5 py-1.5 text-[10px] text-[var(--color-forest)] shadow-md ring-1 ring-[var(--color-fog)] sm:max-w-[min(92%,22rem)] sm:px-3 sm:py-2 sm:text-[11px]">
          <p className="font-semibold">Viento en ruta</p>
          <p className="text-[var(--color-stone)]">{windCaption}</p>
          <p className="mt-1 hidden text-[10px] text-[var(--color-stone)] sm:block">
            Verde = cola · Azul = lateral · Naranja = cara · Flecha = hacia dónde sopla
          </p>
        </div>
      )}
    </div>
  )
}
