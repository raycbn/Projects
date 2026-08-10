import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import { setWorkerUrl } from 'maplibre-gl'
import type { Map, MapMouseEvent, Marker } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import type { LatLng, RouteGeometry, Waypoint } from '@/domain/types'
import { getMapStyleUrl } from '@/lib/mapTiles'

/**
 * Vite bundles MapLibre into a chunk, so its relative worker URL breaks
 * (browser receives index.html instead of the worker). Point at the files
 * copied into dist/assets by vite.config.ts.
 */
setWorkerUrl(`${import.meta.env.BASE_URL}assets/maplibre-gl-worker.mjs`)

const STYLE_URL = getMapStyleUrl()

interface MapViewProps {
  waypoints: Waypoint[]
  geometry?: RouteGeometry | null
  hoverPoint?: LatLng | null
  /** Wind overlay along the route (segments + arrows) for a selected hour/window. */
  windOverlay?: FeatureCollection | null
  windCaption?: string | null
  interactive?: boolean
  onMapClick?: (position: LatLng) => void
  onWaypointDrag?: (id: string, position: LatLng) => void
  className?: string
  fitKey?: string
}

function ensureRouteLayers(map: Map) {
  if (map.getSource('route')) return

  map.addSource('route', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'route-line-casing',
    type: 'line',
    source: 'route',
    paint: {
      'line-color': '#04140e',
      'line-width': 10,
      'line-opacity': 0.55,
    },
  })
  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#d6ff4b',
      'line-width': 5,
    },
  })
}

function createWindArrowImage(
  fill: string,
): { data: Uint8Array; width: number; height: number } {
  const width = 96
  const height = 96
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return { data: new Uint8Array(width * height * 4), width, height }
  }
  ctx.clearRect(0, 0, width, height)
  ctx.translate(width / 2, height / 2)
  // Soft halo so the glyph stays readable on green/orange route segments
  ctx.beginPath()
  ctx.arc(0, 0, 28, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.fill()
  // Point to the right (0° in MapLibre icon-rotate is east / right)
  ctx.beginPath()
  ctx.moveTo(30, 0)
  ctx.lineTo(-24, -18)
  ctx.lineTo(-12, 0)
  ctx.lineTo(-24, 18)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = '#04140e'
  ctx.stroke()
  const imageData = ctx.getImageData(0, 0, width, height)
  return { data: new Uint8Array(imageData.data), width, height }
}

const WIND_ARROW_IMAGES: Record<string, string> = {
  'wind-arrow-cola': '#16a34a',
  'wind-arrow-lateral': '#0284c7',
  'wind-arrow-cara': '#ea580c',
  'wind-arrow': '#0d3b2b',
}

function ensureWindArrowImage(map: Map) {
  for (const [id, fill] of Object.entries(WIND_ARROW_IMAGES)) {
    if (map.hasImage(id)) continue
    const img = createWindArrowImage(fill)
    map.addImage(id, img, { pixelRatio: 2 })
  }
}

function ensureWindLayers(map: Map) {
  ensureWindArrowImage(map)
  if (!map.getSource('route-wind')) {
    map.addSource('route-wind', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
  }

  if (!map.getLayer('route-wind-segments')) {
    map.addLayer({
      id: 'route-wind-segments',
      type: 'line',
      source: 'route-wind',
      filter: ['==', ['get', 'kind'], 'segment'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-width': [
          'interpolate',
          ['linear'],
          ['get', 'windSpeedKmh'],
          0,
          7,
          10,
          10,
          25,
          14,
          45,
          18,
        ],
        'line-opacity': 0.95,
        'line-color': [
          'interpolate',
          ['linear'],
          ['get', 'relativeFactor'],
          -1,
          '#16a34a',
          -0.35,
          '#22c55e',
          0,
          '#38bdf8',
          0.35,
          '#f97316',
          1,
          '#dc2626',
        ],
      },
    })
  }

  // Direction ticks (LineString) — always visible even if symbol icons fail to paint.
  if (!map.getLayer('route-wind-barbs')) {
    map.addLayer({
      id: 'route-wind-barbs',
      type: 'line',
      source: 'route-wind',
      filter: ['==', ['get', 'kind'], 'barb'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-width': [
          'interpolate',
          ['linear'],
          ['get', 'windSpeedKmh'],
          0,
          3.5,
          15,
          5,
          35,
          7,
        ],
        'line-opacity': 0.95,
        'line-color': [
          'match',
          ['get', 'relative'],
          'cola',
          '#15803d',
          'cara',
          '#c2410c',
          '#0369a1',
        ],
      },
    })
  }

  if (!map.getLayer('route-wind-arrows')) {
    map.addLayer({
      id: 'route-wind-arrows',
      type: 'symbol',
      source: 'route-wind',
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
          ['get', 'windSpeedKmh'],
          0,
          0.95,
          15,
          1.15,
          35,
          1.4,
        ],
        'icon-rotate': ['get', 'windTowardDeg'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-padding': 0,
        'symbol-z-order': 'source',
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
      source: 'route-wind',
      filter: [
        'all',
        ['==', ['get', 'kind'], 'arrow'],
        ['!=', ['get', 'legLabel'], ''],
      ],
      layout: {
        'text-field': ['get', 'legLabel'],
        'text-size': 12,
        'text-offset': [0, 1.6],
        'text-anchor': 'top',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-optional': true,
      },
      paint: {
        'text-color': '#0d3b2b',
        'text-halo-color': 'rgba(255,255,255,0.95)',
        'text-halo-width': 1.8,
      },
    })
  }

  // Keep wind visuals above the base route line
  for (const id of [
    'route-wind-segments',
    'route-wind-barbs',
    'route-wind-arrows',
    'route-wind-labels',
  ]) {
    if (map.getLayer(id)) map.moveLayer(id)
  }
}

function applyGeometry(map: Map, geo: RouteGeometry | null | undefined, fit: boolean) {
  if (!map.isStyleLoaded()) return false

  ensureRouteLayers(map)
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

function applyWindOverlay(map: Map, overlay: FeatureCollection | null | undefined) {
  if (!map.isStyleLoaded()) return false
  ensureWindLayers(map)
  const source = map.getSource('route-wind') as maplibregl.GeoJSONSource | undefined
  if (!source) return false
  const data = overlay ?? { type: 'FeatureCollection' as const, features: [] }
  source.setData(data)

  const hasWind = data.features.length > 0
  // Dim lime base route so colored wind segments dominate
  if (map.getLayer('route-line')) {
    map.setPaintProperty('route-line', 'line-opacity', hasWind ? 0.25 : 1)
    map.setPaintProperty('route-line', 'line-width', hasWind ? 3 : 5)
  }
  if (map.getLayer('route-line-casing')) {
    map.setPaintProperty('route-line-casing', 'line-opacity', hasWind ? 0.2 : 0.55)
  }
  return true
}

export function MapView({
  waypoints,
  geometry,
  hoverPoint,
  windOverlay,
  windCaption,
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
  const geometryRef = useRef<RouteGeometry | null | undefined>(geometry)
  const windRef = useRef<FeatureCollection | null | undefined>(windOverlay)
  geometryRef.current = geometry
  windRef.current = windOverlay

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
      applyWindOverlay(map, windRef.current)
    }

    const resize = () => map.resize()

    map.on('load', () => {
      // Flex 50/50 layout: container often settles after first paint — resize twice.
      resize()
      requestAnimationFrame(() => {
        resize()
        paintFromRef(true)
      })
    })
    map.on('styledata', () => {
      if (map.isStyleLoaded()) paintFromRef(Boolean(geometryRef.current))
    })
    map.on('error', (e: { error?: Error }) => {
      console.error('[maplibre]', e.error ?? e)
    })

    const ro = new ResizeObserver(() => resize())
    ro.observe(containerRef.current)

    if (onMapClick) {
      map.on('click', (e: MapMouseEvent) => {
        onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      })
    }

    mapRef.current = map
    return () => {
      ro.disconnect()
      markersRef.current.forEach((m) => m.remove())
      hoverMarkerRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    applyWindOverlay(map, windRef.current)
  }, [geometry, fitKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
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

  return (
    <div className={className ? `relative ${className}` : 'relative h-full min-h-[320px] w-full'}>
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full"
        role="application"
        aria-label="Mapa de rutas ciclistas"
      />
      {windCaption && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[min(92%,22rem)] rounded-xl bg-white/90 px-3 py-2 text-[11px] text-[var(--color-forest)] shadow-md ring-1 ring-[var(--color-fog)]">
          <p className="font-semibold">Viento en ruta</p>
          <p className="text-[var(--color-stone)]">{windCaption}</p>
          <p className="mt-1 text-[10px] text-[var(--color-stone)]">
            Verde = cola · Azul = lateral · Naranja/rojo = cara · Flecha y raya = hacia dónde sopla ·
            Grosor = intensidad
          </p>
        </div>
      )}
    </div>
  )
}
