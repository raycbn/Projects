import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/hooks/usePageMeta'
import { FREE_LIMITS } from '@/domain/types'

const faqs: Array<{ q: string; a: string[] }> = [
  {
    q: '¿Cómo creo mi primera ruta?',
    a: [
      'Entra en Crear una ruta. Escribe dónde sales y dónde quieres llegar (o toca el mapa), elige tu tipo de bici y pulsa Crear ruta.',
      'En unos segundos verás el recorrido en el mapa, con kilómetros, tiempo estimado, desnivel y qué tipo de suelo vas a pisar.',
    ],
  },
  {
    q: '¿Para qué sirve elegir el tipo de bici?',
    a: [
      'No es solo una etiqueta: cambia cómo PedalMap busca el camino. Carretera prioriza asfalto; gravel y MTB admiten más pista o tierra; urbana busca un trayecto práctico en ciudad; e-bike adapta el ritmo.',
      'También verás si la ruta encaja bien con tu modalidad (por ejemplo, mucha tierra en una bici de carretera).',
    ],
  },
  {
    q: '¿Qué es el modo Objetivo (ruta circular)?',
    a: [
      'Sirve cuando no tienes un destino concreto, solo quieres rodar X kilómetros o un desnivel concreto y volver al mismo sitio.',
      'Indicas el punto de salida, los km (y el desnivel si quieres) y PedalMap propone una circular lo más cercana a ese objetivo. Esta opción forma parte de Premium.',
    ],
  },
  {
    q: '¿Cómo veo el desnivel de la ruta?',
    a: [
      'Al calcular la ruta, PedalMap pide el perfil de elevación del recorrido. Verás el desnivel positivo y negativo, y un gráfico que puedes seguir junto al mapa.',
      'Así sabes si la salida es suave o si hay un puerto antes de salir de casa.',
    ],
  },
  {
    q: '¿Qué pasa con el viento?',
    a: [
      'PedalMap consulta el viento previsto a lo largo de la línea de la ruta. Te ayuda a decidir si ese día conviene otro sentido, otra hora u otra alternativa.',
      'Es una ayuda de planificación: el tiempo real puede cambiar, sobre todo en montaña.',
    ],
  },
  {
    q: '¿Puedo descargar la ruta en GPX?',
    a: [
      'Sí, con Premium: cuando la ruta esté calculada, en el panel de exportación puedes descargar el archivo GPX o compartirlo.',
      'Así la abres en el GPS del manillar, OsmAnd, Organic Maps, Garmin Connect, Wahoo y otras apps compatibles. En Free puedes planificar y guardar rutas con los límites del plan.',
    ],
  },
  {
    q: '¿Necesito cuenta para empezar?',
    a: [
      'No. Puedes abrir el planificador y probar sin registrarte.',
      'Crea una cuenta (email o Google) cuando quieras guardar rutas en la nube, sincronizar entre dispositivos o pasar a Premium.',
    ],
  },
  {
    q: '¿Qué incluye Free y qué aporta Premium?',
    a: [
      `Free es para empezar de verdad: hasta ${FREE_LIMITS.maxRoutesSaved} rutas guardadas, ${FREE_LIMITS.maxRoutesCreatedPerMonth} creaciones al mes y hasta ${FREE_LIMITS.maxActivePreferences} filtros a la vez. Incluye rutas de A a B, ida y vuelta, viento y superficie.`,
      'Premium quita esos techos, añade el modo Objetivo (circular por km/desnivel), la exportación GPX y más filtros. Cuesta 4,99 €/mes o 39,99 €/año. Puedes probar Free sin tarjeta.',
    ],
  },
  {
    q: '¿Funciona en el móvil?',
    a: [
      'Sí. PedalMap es una web pensada para usarla en el teléfono: planificas, guardas y, si quieres, inicias el seguimiento GPS de la salida.',
      'Para navegar con el archivo en un GPS dedicado, exporta el GPX (Premium) y ábrelo en tu dispositivo o app favorita.',
    ],
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
      <section className="relative min-h-[88vh]">
        <div
          className="absolute inset-0 overflow-hidden bg-cover bg-center"
          style={{
            backgroundImage:
              'linear-gradient(115deg, rgba(7,21,16,0.78), rgba(13,59,43,0.28)), url(https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=2000&q=80)',
          }}
          role="img"
          aria-label="Ciclistas en carretera entre paisaje abierto"
        />
        <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-end px-4 pb-16 pt-24 md:justify-center md:px-6">
          <p className="animate-rise font-display text-[clamp(2.5rem,11vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.03em] text-white drop-shadow md:text-7xl">
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
              <Button
                variant="ghost"
                className="!border-white/55 !bg-white/10 !px-6 !py-3 !text-white backdrop-blur-sm"
              >
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
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {[
            ['01', 'Elige puntos y bici', 'Origen, destino u Objetivo. Cada modalidad prioriza su suelo.'],
            ['02', 'Calcula', 'Distancia, desnivel, viento y la mejor superficie para tu bici.'],
            ['03', 'Guarda, GPX o GPS', 'Sincroniza, exporta GPX o inicia el seguimiento.'],
          ].map(([num, title, text]) => (
            <li key={num}>
              <p className="font-display text-4xl font-extrabold text-[var(--color-fog)]">{num}</p>
              <h3 className="mt-2 font-display text-xl font-bold text-[var(--color-forest)]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-stone)]">{text}</p>
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
                <li>· A→B, ida-vuelta, viento y superficie</li>
              </ul>
              <Link to="/route-planner" className="mt-6 inline-block">
                <Button>Probar gratis</Button>
              </Link>
            </div>
            <div className="rounded-3xl bg-[var(--color-forest)] p-6 text-white">
              <h3 className="font-display text-2xl font-bold">Premium</h3>
              <ul className="mt-4 space-y-2 text-sm text-white/85">
                <li>· Rutas y filtros ilimitados</li>
                <li>· Modo Objetivo (circular km + desnivel)</li>
                <li>· Exportación / compartir GPX</li>
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
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-3xl font-extrabold">Todo lo que necesitas para salir</h2>
          <p className="mt-2 max-w-2xl text-white/70">
            Routing real, viento, elevación y exportación — sin mapas falsos.
          </p>
          <ul className="mt-10 grid gap-8 sm:grid-cols-2">
            {[
              [
                'Crear rutas',
                'Motor ciclista afinado por modalidad y tipo de suelo, con idoneidad clara.',
              ],
              [
                'Viento y elevación',
                'Open-Meteo sobre la línea y perfil de desnivel sincronizado con el mapa.',
              ],
              [
                'Guardar y compartir',
                'Tus recorridos en la nube, con enlace de solo lectura cuando quieras.',
              ],
              [
                'GPS y GPX',
                'Actividad en el móvil o exporta a OsmAnd, Organic Maps, Garmin Connect o Wahoo.',
              ],
            ].map(([title, text]) => (
              <li key={title}>
                <h3 className="font-display text-xl font-bold text-[var(--color-signal)]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/75">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        <h2 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">
          Preguntas frecuentes
        </h2>
        <p className="mt-2 max-w-2xl text-[var(--color-stone)]">
          Respuestas cortas a lo que más suelen preguntar antes de la primera salida.
        </p>
        <div className="mt-6 space-y-3">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl bg-white/80 p-4 ring-1 ring-[var(--color-fog)] open:ring-[var(--color-trail)]/35"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 font-semibold text-[var(--color-forest)]">
                <span>{item.q}</span>
                <span
                  aria-hidden
                  className="mt-0.5 shrink-0 text-[var(--color-stone)] transition group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="mt-3 space-y-3 border-t border-[var(--color-fog)] pt-3">
                {item.a.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-relaxed text-[var(--color-stone)]">
                    {paragraph}
                  </p>
                ))}
              </div>
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
