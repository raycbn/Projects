import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import { setWorkerUrl } from 'maplibre-gl'
import type { Map, MapMouseEvent, Marker } from 'maplibre-gl'
import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import type { LatLng, RouteGeometry, Waypoint } from '@/domain/types'
import { getMapStyleUrl, loadMapStyleSpec } from '@/lib/mapTiles'

/**
 * Vite bundles MapLibre into a chunk, so its relative worker URL breaks
 * (browser receives index.html instead of the worker). Point at the files
 * copied into dist/assets by vite.config.ts.
 */
setWorkerUrl(`${import.meta.env.BASE_URL}assets/maplibre-gl-worker.mjs`)

let cachedStyle: string | Record<string, unknown> | null = null
async function resolveMapStyle(): Promise<string | Record<string, unknown>> {
  if (cachedStyle) return cachedStyle
  cachedStyle = await loadMapStyleSpec().catch(() => getMapStyleUrl())
  return cachedStyle
}

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
  /** When false, hide wind barbs/chevrons/icons (colored segments stay). */
  showWindArrows?: boolean
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
  'wind-arrow-cola-v2': '#16a34a',
  'wind-arrow-lateral-v2': '#0284c7',
  'wind-arrow-cara-v2': '#ea580c',
}

function ensureWindArrowImages(map: Map) {
  for (const [id, fill] of Object.entries(WIND_ARROW_IMAGES)) {
    if (map.hasImage(id)) continue
    try {
      const img = createWindArrowImage(fill)
      // MapLibre accepts { width, height, data }; avoid pixelRatio quirks that shrink icons to invisible.
      map.addImage(id, img)
    } catch (error) {
      console.warn('[maplibre] wind arrow image', id, error)
    }
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
      filter: ['==', ['get', 'kind'], 'barb'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8,
          3.5,
          12,
          5,
          15,
          6.5,
        ],
        'line-opacity': 1,
        'line-color': WIND_COLOR_EXPR,
      },
    })
  }

  if (!map.getLayer('route-wind-arrowheads')) {
    map.addLayer({
      id: 'route-wind-arrowheads',
      type: 'line',
      source: 'route-wind-lines',
      filter: ['==', ['get', 'kind'], 'arrowhead'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8,
          4,
          12,
          6.5,
          15,
          8,
        ],
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
      filter: ['==', ['get', 'kind'], 'arrow'],
      layout: {
        'icon-image': [
          'match',
          ['get', 'relative'],
          'cola',
          'wind-arrow-cola-v2',
          'cara',
          'wind-arrow-cara-v2',
          'wind-arrow-lateral-v2',
        ],
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8,
          0.28,
          11,
          0.42,
          14,
          0.58,
        ],
        'icon-rotate': ['to-number', ['get', 'windTowardDeg']],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-padding': 0,
        'symbol-placement': 'point',
      },
      paint: {
        'icon-opacity': 0.95,
      },
    })
  }

  if (!map.getLayer('route-wind-labels')) {
    map.addLayer({
      id: 'route-wind-labels',
      type: 'symbol',
      source: 'route-wind-points',
      minzoom: 11,
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
    'route-wind-arrowheads',
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
  // Upgrade path: older sessions may lack arrowhead layer — rebuild wind stack once.
  if (overlay?.features?.length && !map.getLayer('route-wind-arrowheads')) {
    rebuildWindLayers(map)
  } else {
    ensureWindLayers(map)
  }

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
    'route-wind-arrowheads',
    'route-wind-arrows',
    'route-wind-labels',
  ]) {
    if (map.getLayer(id)) map.moveLayer(id)
  }

  map.triggerRepaint()
  return true
}

function setWindArrowLayersVisible(map: Map, visible: boolean) {
  const value = visible ? 'visible' : 'none'
  for (const id of [
    'route-wind-barbs',
    'route-wind-arrowheads',
    'route-wind-arrows',
    'route-wind-labels',
  ]) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', value)
    }
  }
}

/** Full rebuild of wind layers (recovers from style glitches / missing images). */
function rebuildWindLayers(map: Map) {
  for (const id of [
    'route-wind-labels',
    'route-wind-arrows',
    'route-wind-arrowheads',
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
  showWindArrows = true,
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
  const showWindArrowsRef = useRef(showWindArrows)
  const hasWindOverlay = Boolean(windOverlay?.features?.length)
  followUserRef.current = followUser
  geometryRef.current = geometry
  windRef.current = windOverlay
  surfaceRef.current = surfaceOverlay
  onMapClickRef.current = onMapClick
  showWindArrowsRef.current = showWindArrows

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const container = containerRef.current
    let cancelled = false
    let map: Map | null = null
    let ro: ResizeObserver | null = null

    void resolveMapStyle().then((style) => {
      if (cancelled || !container) return
      map = new maplibregl.Map({
        container,
        style: style as string,
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
        if (!map) return
        applyGeometry(map, geometryRef.current, fit)
        applySurfaceOverlay(map, surfaceRef.current)
        applyWindOverlay(map, windRef.current)
        setWindArrowLayersVisible(map, showWindArrowsRef.current)
      }

      const resize = () => map?.resize()

      map.on('load', () => {
        resize()
        requestAnimationFrame(() => {
          resize()
          paintFromRef(true)
        })
      })
      // Only repair missing overlay layers after a style swap — skip no-op styledata ticks.
      map.on('styledata', () => {
        if (!map?.isStyleLoaded()) return
        const needsRoute =
          Boolean(geometryRef.current?.coordinates?.length) && !map.getLayer('route-line')
        const needsWind =
          Boolean(windRef.current?.features?.length) && !map.getLayer('route-wind-segments')
        const needsSurface =
          Boolean(surfaceRef.current?.features?.length) && !map.getLayer('route-surface-line')
        if (!needsRoute && !needsWind && !needsSurface) return
        if (needsWind) rebuildWindLayers(map)
        paintFromRef(false)
      })
      map.on('error', (e: { error?: Error }) => {
        console.error('[maplibre]', e.error ?? e)
      })

      ro = new ResizeObserver(() => resize())
      ro.observe(container)

      map.on('click', (e: MapMouseEvent) => {
        onMapClickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      })

      mapRef.current = map
    })

    return () => {
      cancelled = true
      ro?.disconnect()
      markersRef.current.forEach((m) => m.remove())
      hoverMarkerRef.current?.remove()
      userMarkerRef.current?.remove()
      map?.remove()
      if (mapRef.current === map) mapRef.current = null
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
    setWindArrowLayersVisible(map, showWindArrowsRef.current)
  }, [geometry, fitKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    applySurfaceOverlay(map, surfaceOverlay)
  }, [surfaceOverlay])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    applyWindOverlay(map, windOverlay)
    setWindArrowLayersVisible(map, showWindArrows)
  }, [windOverlay, showWindArrows])

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
      {surfaceOverlay?.features?.length && !hasWindOverlay ? (
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
            Verde = cola · Azul = lateral · Naranja = cara
            {showWindArrows ? ' · Flecha = hacia dónde sopla' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
