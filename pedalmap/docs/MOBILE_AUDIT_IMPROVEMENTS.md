# PedalMap — auditoria movil + roadmap

Fecha: 2026-08-10 (actualizado).

## Shipado

### Routing / superficie
- Valhalla surface-aware (A→B, ida-vuelta, Objetivo)
- Linea de ruta coloreada por superficie (asfalto/tierra/?)
- Alerta de tramos sin asfaltar segun bici
- Comparador Carretera / Gravel / MTB
- Feedback Objetivo (% error distancia/desnivel)
- Otra variante + Estoy aqui + tap mapa

### Ride
- Navegacion guiada (`/navegacion`) con GPS, off-route, voz, progreso
- Handoff GPS con geometria + instructions
- Share card PNG para WhatsApp

### Freemium / persistencia
- Contadores Firestore client-side
- Borrador local + nube (`users.plannerDraft`)
- PWA manifest + service worker shell
- Wind declutter (minzoom / menos density)

## Pendiente comercial
- `STADIA_API_KEY` en Worker (SLA Valhalla)
- Stripe live
- Dominio propio
- Offline tiles densas / import Strava-Komoot link
