import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import { setWorkerUrl } from 'maplibre-gl'
import type { Map, MapMouseEvent, Marker } from 'maplibre-gl'
import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import type { LatLng, RouteGeometry, Waypoint } from '@/domain/types'
import { getMapStyleUrl, loadMapStyleSpec } from '@/lib/mapTiles'
import {
  MAP_HILLSHADE_LAYER_ID,
  MAP_HILLSHADE_SOURCE_ID,
  MAP_TERRAIN_SOURCE_ID,
  MAP_TERRAIN_TILEJSON,
  readMap3dPreference,
  routeStartBearing,
  writeMap3dPreference,
} from '@/lib/map3d'

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
  /** Show Plano/3D toggle (default true). */
  showTerrainToggle?: boolean
  /** Force 3D on/off; omit to use saved preference (default on). */
  terrain3d?: boolean
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
  if (!canPaintOverlays(map)) return false
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
 * Style JSON may be ready while DEM tiles are still loading.
 * MapLibre's isStyleLoaded() waits for ALL sources (including terrain) — too strict
 * for GeoJSON route/wind overlays and was blanking the map after enabling 3D.
 */
function canPaintOverlays(map: Map): boolean {
  try {
    return Boolean(map.getStyle()?.layers?.length)
  } catch {
    return false
  }
}

/** Keep route + wind above basemap / hillshade after terrain swaps. */
function raiseRouteOverlayLayers(map: Map) {
  for (const id of [
    'route-line-casing',
    'route-line',
    'route-surface-line',
    'route-wind-segments',
    'route-wind-barbs',
    'route-wind-arrowheads',
    'route-wind-arrows',
    'route-wind-labels',
  ]) {
    if (map.getLayer(id)) {
      try {
        map.moveLayer(id)
      } catch {
        /* ignore */
      }
    }
  }
}

/** Attach free Mapterhorn DEM + hillshade. Safe to call after style load / style swap. */
export function ensureTerrainLayers(map: Map) {
  if (!map.getSource(MAP_TERRAIN_SOURCE_ID)) {
    map.addSource(MAP_TERRAIN_SOURCE_ID, {
      type: 'raster-dem',
      url: MAP_TERRAIN_TILEJSON,
      tileSize: 512,
      encoding: 'terrarium',
      attribution: '© Mapterhorn',
    })
  }
  if (!map.getSource(MAP_HILLSHADE_SOURCE_ID)) {
    map.addSource(MAP_HILLSHADE_SOURCE_ID, {
      type: 'raster-dem',
      url: MAP_TERRAIN_TILEJSON,
      tileSize: 512,
      encoding: 'terrarium',
    })
  }
  if (!map.getLayer(MAP_HILLSHADE_LAYER_ID)) {
    // Prefer under the route casing so the track stays readable.
    const beforeId = map.getLayer('route-line-casing')
      ? 'route-line-casing'
      : map.getLayer('route-line')
        ? 'route-line'
        : undefined
    map.addLayer(
      {
        id: MAP_HILLSHADE_LAYER_ID,
        type: 'hillshade',
        source: MAP_HILLSHADE_SOURCE_ID,
        layout: { visibility: 'visible' },
        paint: {
          'hillshade-shadow-color': '#2c2416',
          'hillshade-highlight-color': '#f5f0e6',
          'hillshade-accent-color': '#5c4a32',
          'hillshade-exaggeration': 0.45,
        },
      },
      beforeId,
    )
  }
}

export function setMapTerrainEnabled(map: Map, enabled: boolean) {
  ensureTerrainLayers(map)
  if (enabled) {
    map.setTerrain({ source: MAP_TERRAIN_SOURCE_ID, exaggeration: 1.25 })
    if (map.getLayer(MAP_HILLSHADE_LAYER_ID)) {
      map.setLayoutProperty(MAP_HILLSHADE_LAYER_ID, 'visibility', 'visible')
    }
  } else {
    map.setTerrain(null)
    if (map.getLayer(MAP_HILLSHADE_LAYER_ID)) {
      map.setLayoutProperty(MAP_HILLSHADE_LAYER_ID, 'visibility', 'none')
    }
  }
  raiseRouteOverlayLayers(map)
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
          0.4,
          11,
          0.58,
          14,
          0.78,
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

function applyGeometry(
  map: Map,
  geo: RouteGeometry | null | undefined,
  fit: boolean,
  terrain3d = false,
) {
  if (!canPaintOverlays(map)) return false

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
    fitMapToGeometry(map, geo, { terrain3d })
  }

  return true
}

/** Pan/zoom the camera to the route LineString (used after GPX import / new geometry). */
export function fitMapToGeometry(
  map: Map,
  geo: RouteGeometry,
  opts?: {
    padding?: number
    duration?: number
    /** Pitch + bearing along the route (Strava-like reveal). */
    terrain3d?: boolean
  },
) {
  if (geo.coordinates.length < 2) return
  const bounds = geo.coordinates.reduce(
    (b, c) => b.extend(c as [number, number]),
    new maplibregl.LngLatBounds(
      geo.coordinates[0] as [number, number],
      geo.coordinates[0] as [number, number],
    ),
  )
  const padding = opts?.padding ?? 56
  const terrain3d = Boolean(opts?.terrain3d)
  const duration = opts?.duration ?? (terrain3d ? 1100 : 750)
  const bearing = terrain3d
    ? routeStartBearing(geo.coordinates as [number, number][])
    : 0
  const pitch = terrain3d ? 52 : 0
  const run = () => {
    try {
      map.resize()
    } catch {
      /* ignore */
    }
    map.fitBounds(bounds, {
      padding,
      duration,
      maxZoom: terrain3d ? 13.5 : 14,
      pitch,
      bearing,
      essential: true,
    })
  }
  // Guard against zero-size containers (fitBounds then no-ops / jumps oddly).
  const canvas = map.getCanvas()
  if (canvas.clientWidth < 32 || canvas.clientHeight < 32) {
    map.once('idle', () => {
      requestAnimationFrame(run)
    })
    return
  }
  // Double rAF: layout after navigating to /ruta often settles one frame late.
  requestAnimationFrame(() => requestAnimationFrame(run))
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
  if (!canPaintOverlays(map)) return false
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
  showTerrainToggle = true,
  terrain3d: terrain3dProp,
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
  const fitKeyRef = useRef(fitKey)
  const lastFittedKeyRef = useRef<string | undefined>(undefined)
  const terrain3dRef = useRef(false)
  const [terrain3d, setTerrain3d] = useState(() =>
    terrain3dProp !== undefined ? terrain3dProp : readMap3dPreference(true),
  )
  const hasWindOverlay = Boolean(windOverlay?.features?.length)
  followUserRef.current = followUser
  geometryRef.current = geometry
  windRef.current = windOverlay
  surfaceRef.current = surfaceOverlay
  onMapClickRef.current = onMapClick
  showWindArrowsRef.current = showWindArrows
  fitKeyRef.current = fitKey
  terrain3dRef.current = terrain3d

  useEffect(() => {
    if (terrain3dProp === undefined) return
    setTerrain3d(terrain3dProp)
  }, [terrain3dProp])

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
        pitch: terrain3dRef.current ? 45 : 0,
        maxPitch: 85,
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
        const key = fitKeyRef.current
        const shouldFit = fit && Boolean(key)
        const ok = applyGeometry(map, geometryRef.current, shouldFit, terrain3dRef.current)
        if (shouldFit && ok && key) lastFittedKeyRef.current = key
        applySurfaceOverlay(map, surfaceRef.current)
        applyWindOverlay(map, windRef.current)
        setWindArrowLayersVisible(map, showWindArrowsRef.current)
      }

      const resize = () => {
        if (!map) return
        map.resize()
        // After layout settles (e.g. navigating to /ruta after GPX), refit once.
        const key = fitKeyRef.current
        const geo = geometryRef.current
        if (key && geo && geo.coordinates.length >= 2 && lastFittedKeyRef.current !== key) {
          requestAnimationFrame(() => {
            if (!mapRef.current) return
            const ok = applyGeometry(
              mapRef.current,
              geometryRef.current,
              true,
              terrain3dRef.current,
            )
            if (ok) lastFittedKeyRef.current = key
          })
        }
      }

      map.on('load', () => {
        // Paint route/wind FIRST — enabling DEM before paint makes isStyleLoaded() false
        // and used to blank the track until a full remount.
        resize()
        requestAnimationFrame(() => {
          resize()
          paintFromRef(true)
          raiseRouteOverlayLayers(map!)
          // Terrain after overlays exist; re-assert paint once DEM settles.
          map!.once('idle', () => {
            try {
              setMapTerrainEnabled(map!, terrain3dRef.current)
            } catch (err) {
              console.warn('[maplibre] terrain', err)
            }
            paintFromRef(false)
            raiseRouteOverlayLayers(map!)
          })
        })
      })
      // Repair missing overlay layers after style swaps / DEM source churn.
      const repairOverlays = () => {
        if (!map || !canPaintOverlays(map)) return
        try {
          if (terrain3dRef.current && !map.getSource(MAP_TERRAIN_SOURCE_ID)) {
            setMapTerrainEnabled(map, true)
          }
        } catch {
          /* ignore */
        }
        const needsRoute =
          Boolean(geometryRef.current?.coordinates?.length) && !map.getLayer('route-line')
        const needsWind =
          Boolean(windRef.current?.features?.length) && !map.getLayer('route-wind-segments')
        const needsSurface =
          Boolean(surfaceRef.current?.features?.length) && !map.getLayer('route-surface-line')
        if (!needsRoute && !needsWind && !needsSurface) return
        if (needsWind) rebuildWindLayers(map)
        paintFromRef(false)
        raiseRouteOverlayLayers(map)
      }
      map.on('styledata', repairOverlays)
      map.on('idle', repairOverlays)
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
    if (!map || !canPaintOverlays(map)) return
    try {
      setMapTerrainEnabled(map, terrain3d)
    } catch (err) {
      console.warn('[maplibre] terrain toggle', err)
    }
    applyGeometry(map, geometryRef.current, false, terrain3d)
    applySurfaceOverlay(map, surfaceRef.current)
    applyWindOverlay(map, windRef.current)
    setWindArrowLayersVisible(map, showWindArrowsRef.current)
    raiseRouteOverlayLayers(map)
    if (!terrain3d) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 500, essential: true })
    } else if (geometryRef.current && geometryRef.current.coordinates.length >= 2) {
      fitMapToGeometry(map, geometryRef.current, { terrain3d: true, duration: 900 })
    } else {
      map.easeTo({ pitch: 50, duration: 600, essential: true })
    }
  }, [terrain3d])

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
    const shouldFit = Boolean(fitKey) && lastFittedKeyRef.current !== fitKey
    const ok = applyGeometry(map, geometry, shouldFit, terrain3dRef.current)
    if (shouldFit && ok && fitKey) {
      lastFittedKeyRef.current = fitKey
    } else if (!ok) {
      // Style/DEM not ready — retry once idle so the track is never dropped.
      map.once('idle', () => {
        const m = mapRef.current
        if (!m || !canPaintOverlays(m)) return
        const key = fitKeyRef.current
        const painted = applyGeometry(
          m,
          geometryRef.current,
          Boolean(key) && lastFittedKeyRef.current !== key,
          terrain3dRef.current,
        )
        if (painted && key) lastFittedKeyRef.current = key
        applySurfaceOverlay(m, surfaceRef.current)
        applyWindOverlay(m, windRef.current)
        setWindArrowLayersVisible(m, showWindArrowsRef.current)
        raiseRouteOverlayLayers(m)
      })
    } else if (!shouldFit) {
      applyGeometry(map, geometry, false, terrain3dRef.current)
    }
    applySurfaceOverlay(map, surfaceRef.current)
    applyWindOverlay(map, windRef.current)
    setWindArrowLayersVisible(map, showWindArrowsRef.current)
    raiseRouteOverlayLayers(map)
  }, [geometry, fitKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    applySurfaceOverlay(map, surfaceOverlay)
  }, [surfaceOverlay])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const ok = applyWindOverlay(map, windOverlay)
    setWindArrowLayersVisible(map, showWindArrows)
    // If style was not ready, retry once after idle so the overlay is not dropped.
    if (!ok && windOverlay?.features?.length) {
      map.once('idle', () => {
        applyWindOverlay(map, windRef.current)
        setWindArrowLayersVisible(map, showWindArrowsRef.current)
      })
    }
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
        pitch: terrain3dRef.current ? Math.max(map.getPitch(), 48) : map.getPitch(),
        duration: 650,
        essential: true,
      })
    }
  }, [showUserLocation, followUser])

  function toggleTerrain() {
    setTerrain3d((prev) => {
      const next = !prev
      writeMap3dPreference(next)
      return next
    })
  }

  return (
    <div className={className ?? 'relative h-full min-h-[320px] w-full'}>
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full"
        role="application"
        aria-label="Mapa de rutas ciclistas"
      />
      {showTerrainToggle ? (
        <button
          type="button"
          onClick={toggleTerrain}
          className="absolute bottom-3 right-3 z-10 min-h-10 rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-[var(--color-forest)] shadow ring-1 ring-[var(--color-fog)]"
          aria-pressed={terrain3d}
          title={terrain3d ? 'Cambiar a mapa plano' : 'Cambiar a mapa 3D con relieve'}
        >
          {terrain3d ? '3D · relieve' : 'Plano'}
        </button>
      ) : null}
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
