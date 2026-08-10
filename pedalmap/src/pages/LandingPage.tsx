import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/hooks/usePageMeta'
import { FREE_LIMITS } from '@/domain/types'

const faqs = [
  {
    q: '¿Cómo crear una ruta en bicicleta?',
    a: 'Abre el planificador, busca dónde empiezas y dónde quieres llegar, elige el tipo de bici y pulsa Crear ruta. PedalMap calcula un recorrido real con distancia, tiempo, desnivel y composición de superficie.',
  },
  {
    q: '¿Qué cambia según el tipo de bici?',
    a: 'Carretera prioriza asfalto; urbana, carril bici; gravel, pistas y grava compacta; MTB, senderos y tierra; e-bike, perfil eléctrico sobre pavimento. Si el suelo no encaja, probamos otra estrategia ORS y te mostramos la idoneidad.',
  },
  {
    q: '¿Cómo crear una ruta GPX?',
    a: 'Tras calcular la ruta, en el panel de exportación puedes descargar o compartir el GPX (Premium). En Free puedes planificar y guardar con límites.',
  },
  {
    q: '¿Cómo calcular el desnivel?',
    a: 'Al calcular la ruta pedimos elevación al motor de routing y mostramos desnivel positivo/negativo y un gráfico interactivo.',
  },
  {
    q: '¿Cómo crear una ruta circular u Objetivo?',
    a: 'Elige el modo Objetivo, indica el punto de partida, los km y el desnivel deseado. Generamos una circular real (ORS round_trip) buscando el mejor ajuste.',
  },
  {
    q: '¿Free o Premium?',
    a: `Free: hasta ${FREE_LIMITS.maxRoutesSaved} rutas guardadas, ${FREE_LIMITS.maxRoutesCreatedPerMonth} creaciones/mes y ${FREE_LIMITS.maxActivePreferences} filtros a la vez. Premium: ilimitado, GPX y más.`,
  },
]

export function LandingPage() {
  usePageMeta({
    title: 'PedalMap — Crea tu próxima ruta en bici',
    description:
      'Planifica rutas ciclistas reales con mapa, desnivel, viento y superficie según tu bici. Free para empezar, Premium cuando lo necesites.',
    path: '/',
  })

  return (
    <main>
      <section className="relative min-h-[88vh] overflow-hidden topo-grid">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              'linear-gradient(115deg, rgba(7,21,16,0.78), rgba(13,59,43,0.28)), url(https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=2000&q=80)',
          }}
          role="img"
          aria-label="Ciclistas en carretera entre paisaje abierto"
        />
        <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-end px-4 pb-16 pt-24 md:justify-center md:px-6">
          <p className="animate-rise font-display text-5xl font-extrabold tracking-tight text-white drop-shadow md:text-7xl">
            PEDALMAP
          </p>
          <h1
            className="mt-4 max-w-2xl animate-rise text-balance text-3xl font-semibold text-white md:text-4xl"
            style={{ animationDelay: '80ms' }}
          >
            Crea tu próxima ruta en bici.
          </h1>
          <p
            className="mt-4 max-w-xl animate-rise text-lg text-white/85"
            style={{ animationDelay: '140ms' }}
          >
            Planifica con el suelo adecuado a tu modalidad, mira el viento y sal con la ruta lista.
            Empieza gratis.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 animate-rise" style={{ animationDelay: '200ms' }}>
            <Link to="/route-planner">
              <Button className="!px-6 !py-3 text-base">Crear una ruta</Button>
            </Link>
            <Link to="/premium">
              <Button variant="ghost" className="!border-white/30 !text-white !px-6 !py-3">
                Ver Premium
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <h2 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">Cómo funciona</h2>
        <p className="mt-2 max-w-2xl text-[var(--color-stone)]">
          Tres pasos claros para salir a rodar con la ruta preparada.
        </p>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            ['1. Elige puntos y bici', 'Origen, destino u Objetivo. Cada modalidad prioriza su suelo.'],
            ['2. Calcula', 'Distancia, desnivel, viento, superficie e idoneidad de la ruta.'],
            ['3. Guarda, GPX o GPS', 'Sincroniza en tu cuenta, exporta GPX o inicia el seguimiento.'],
          ].map(([title, text]) => (
            <li key={title} className="rounded-3xl bg-white/70 p-5 ring-1 ring-[var(--color-fog)]">
              <h3 className="font-display text-xl font-bold text-[var(--color-forest)]">{title}</h3>
              <p className="mt-2 text-sm text-[var(--color-stone)]">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-[var(--color-mist)] px-4 py-16 md:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">
            Free para empezar. Premium cuando lo pidas.
          </h2>
          <p className="mt-2 max-w-2xl text-[var(--color-stone)]">
            Sin tarjeta para probar. Los límites Free están pensados para salidas reales; Premium quita
            el techo.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl bg-white/80 p-6 ring-1 ring-[var(--color-fog)]">
              <h3 className="font-display text-2xl font-bold text-[var(--color-forest)]">Free</h3>
              <ul className="mt-4 space-y-2 text-sm text-[var(--color-stone)]">
                <li>· Hasta {FREE_LIMITS.maxRoutesSaved} rutas guardadas</li>
                <li>· {FREE_LIMITS.maxRoutesCreatedPerMonth} creaciones al mes</li>
                <li>· {FREE_LIMITS.maxActivePreferences} filtros a la vez</li>
                <li>· Objetivo circular, viento y mapa</li>
              </ul>
              <Link to="/route-planner" className="mt-6 inline-block">
                <Button>Probar gratis</Button>
              </Link>
            </div>
            <div className="rounded-3xl bg-[var(--color-forest)] p-6 text-white">
              <h3 className="font-display text-2xl font-bold">Premium</h3>
              <ul className="mt-4 space-y-2 text-sm text-white/85">
                <li>· Rutas y filtros ilimitados</li>
                <li>· Exportación / compartir GPX</li>
                <li>· Todo el planificador sin paywall</li>
                <li>· 4,99 €/mes o 39,99 €/año</li>
              </ul>
              <Link to="/premium" className="mt-6 inline-block">
                <Button className="!bg-[var(--color-signal)] !text-[var(--color-ink)]">
                  Ir a Premium
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--color-panel)] px-4 py-16 text-white md:px-6">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="font-display text-3xl font-extrabold">Crear rutas</h2>
            <p className="mt-3 text-white/75">
              Motor real de routing ciclista, afinado por modalidad de bici y tipo de suelo.
            </p>
          </div>
          <div>
            <h2 className="font-display text-3xl font-extrabold">Viento y elevación</h2>
            <p className="mt-3 text-white/75">
              Open-Meteo sobre la línea + perfil de desnivel sincronizado con el mapa.
            </p>
          </div>
          <div>
            <h2 className="font-display text-3xl font-extrabold">Guardar y compartir</h2>
            <p className="mt-3 text-white/75">
              Tus recorridos en Firestore, con enlace de solo lectura cuando quieras publicarlos.
            </p>
          </div>
          <div>
            <h2 className="font-display text-3xl font-extrabold">GPS y GPX</h2>
            <p className="mt-3 text-white/75">
              Inicia actividad en el móvil o exporta GPX hacia OsmAnd, Organic Maps, Garmin Connect o
              Wahoo.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        <h2 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">
          Preguntas frecuentes
        </h2>
        <div className="mt-6 space-y-3">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl bg-white/80 p-4 ring-1 ring-[var(--color-fog)]"
            >
              <summary className="cursor-pointer list-none font-semibold text-[var(--color-forest)]">
                {item.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-stone)]">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-4 pb-24 md:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 rounded-3xl bg-[var(--color-forest)] px-6 py-8 text-white md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-2xl font-extrabold">¿Listo para trazar tu salida?</h2>
            <p className="mt-1 text-white/75">Abre el mapa y crea tu primera ruta en segundos.</p>
          </div>
          <Link to="/route-planner">
            <Button>Crear una ruta</Button>
          </Link>
        </div>
      </section>
    </main>
  )
}
