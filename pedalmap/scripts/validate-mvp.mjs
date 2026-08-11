#!/usr/bin/env node
/**
 * PedalMap MVP validation — real geocoding + real ORS (when key present).
 * Never prints secret values.
 */
import { writeFileSync } from 'node:fs'

const ORS_BASE = 'https://api.heigit.org/openrouteservice'
const report = {
  at: new Date().toISOString(),
  orsKeyPresent: false,
  orsEndpoint: `${ORS_BASE}/v2/directions/cycling-road/json`,
  geocoding: {},
  routing: null,
  errors: [],
}

function mask(v) {
  if (!v) return null
  return `SET len=${String(v).length}`
}

const orsKey = process.env.VITE_ORS_API_KEY || process.env.ORS_API_KEY || ''
report.orsKeyPresent = Boolean(orsKey.trim())
report.orsKeyStatus = mask(orsKey.trim())

async function geocode(q) {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', q)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '3')
  url.searchParams.set('countrycodes', 'es')
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'PedalMapMVPValidation/1.0 (contact: hola@pedalmap.es)',
    },
  })
  const data = await res.json()
  return {
    status: res.status,
    count: Array.isArray(data) ? data.length : 0,
    first: data?.[0]
      ? {
          label: data[0].display_name,
          lat: Number(data[0].lat),
          lng: Number(data[0].lon),
        }
      : null,
  }
}

async function routeOrs(from, to) {
  if (!orsKey.trim()) {
    return { ok: false, reason: 'VITE_ORS_API_KEY not available in this process' }
  }
  const body = {
    coordinates: [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ],
    elevation: true,
    instructions: false,
    language: 'es',
    preference: 'recommended',
  }
  const res = await fetch(`${ORS_BASE}/v2/directions/cycling-road/json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: orsKey.trim(),
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, status: res.status, bodyPreview: text.slice(0, 200) }
  }
  const route = json.routes?.[0]
  if (!route) {
    return { ok: false, status: res.status, bodyPreview: text.slice(0, 300) }
  }
  return {
    ok: true,
    status: res.status,
    distanceMeters: route.summary?.distance,
    durationSeconds: route.summary?.duration,
    ascent: route.summary?.ascent,
    descent: route.summary?.descent,
    geometryChars: route.geometry?.length ?? 0,
    hasGeometry: Boolean(route.geometry),
  }
}

for (const q of ['Madrid', 'Colmenar Viejo', 'Barajas']) {
  try {
    report.geocoding[q] = await geocode(q)
    await new Promise((r) => setTimeout(r, 1100)) // Nominatim fair use
  } catch (e) {
    report.geocoding[q] = { error: String(e) }
    report.errors.push(`geocode:${q}`)
  }
}

const madrid = report.geocoding.Madrid?.first
const colmenar = report.geocoding['Colmenar Viejo']?.first

if (madrid && colmenar) {
  try {
    report.routing = await routeOrs(madrid, colmenar)
    if (!report.routing.ok) report.errors.push('routing')
  } catch (e) {
    report.routing = { ok: false, error: String(e) }
    report.errors.push('routing_exception')
  }
} else {
  report.routing = { ok: false, reason: 'Missing geocode points' }
  report.errors.push('geocode_points')
}

const out = '/tmp/pedalmap-mvp-validation.json'
writeFileSync(out, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
console.log(`\nWrote ${out}`)
process.exit(report.errors.length ? 1 : 0)
