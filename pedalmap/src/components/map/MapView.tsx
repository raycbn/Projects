import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import { setWorkerUrl } from 'maplibre-gl'
import type { Map, MapMouseEvent, Marker } from 'maplibre-gl'
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

function applyGeometry(map: Map, geo: RouteGeometry | null | undefined, fit: boolean) {
  if (!map.isStyleLoaded()) return false

  ensureRouteLayers(map)
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

export function MapView({
  waypoints,
  geometry,
  hoverPoint,
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
  geometryRef.current = geometry

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
    }

    const resize = () => map.resize()

    map.on('load', () => {
      resize()
      paintFromRef(true)
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
  }, [geometry, fitKey])

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
    <div
      ref={containerRef}
      className={className ?? 'h-full min-h-[320px] w-full'}
      role="application"
      aria-label="Mapa de rutas ciclistas"
    />
  )
}
