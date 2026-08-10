/**
 * Decode Google-encoded polyline (Valhalla uses precision 1e6).
 * Returns [lng, lat][] for GeoJSON LineString.
 */
export function decodePolyline(encoded: string, precision = 6): [number, number][] {
  const coordinates: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0
  const factor = 10 ** precision

  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let byte = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const dlat = result & 1 ? ~(result >> 1) : result >> 1
    lat += dlat

    result = 0
    shift = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const dlng = result & 1 ? ~(result >> 1) : result >> 1
    lng += dlng

    coordinates.push([lng / factor, lat / factor])
  }

  return coordinates
}

/** Encode [lng,lat][] to polyline precision 6 (for Valhalla height/trace). */
export function encodePolyline(coords: [number, number][], precision = 6): string {
  let lastLat = 0
  let lastLng = 0
  let out = ''
  const factor = 10 ** precision

  const write = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63)
      v >>= 5
    }
    out += String.fromCharCode(v + 63)
  }

  for (const [lng, lat] of coords) {
    const ilat = Math.round(lat * factor)
    const ilng = Math.round(lng * factor)
    write(ilat - lastLat)
    write(ilng - lastLng)
    lastLat = ilat
    lastLng = ilng
  }
  return out
}
