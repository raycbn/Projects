import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/hooks/usePageMeta'

const faqs = [
  {
    q: '¿Cómo crear una ruta en bicicleta?',
    a: 'Abre el planificador, busca dónde empiezas y dónde quieres llegar, elige el tipo de bici y pulsa Crear ruta. PedalMap calcula un recorrido real con distancia, tiempo y desnivel.',
  },
  {
    q: '¿Cómo planificar una ruta ciclista?',
    a: 'Define origen y destino, añade waypoints si lo necesitas, revisa el perfil de elevación y guarda la ruta cuando te convenza. Puedes probar sin registrarte.',
  },
  {
    q: '¿Cómo crear una ruta GPX?',
    a: 'La exportación GPX está preparada en la arquitectura y llegará en la siguiente fase. Mientras tanto puedes planificar y guardar rutas en tu cuenta.',
  },
  {
    q: '¿Cómo calcular el desnivel?',
    a: 'Al calcular la ruta, PedalMap solicita elevación al motor de routing y muestra desnivel positivo, negativo y un gráfico interactivo cuando los datos están disponibles.',
  },
  {
    q: '¿Cómo encontrar rutas de bicicleta cerca de mí?',
    a: 'Usa la búsqueda o la geolocalización del mapa para partir desde tu zona. El descubrimiento de rutas públicas cercanas llegará en fases posteriores.',
  },
  {
    q: '¿Cómo crear una ruta circular?',
    a: 'La arquitectura contempla rutas circulares por distancia aproximada, pero el algoritmo avanzado no se simula: se implementará cuando el motor lo soporte de forma fiable.',
  },
  {
    q: '¿Qué diferencia hay entre una ruta MTB y una ruta de carretera?',
    a: 'El perfil MTB usa el perfil cycling-mountain de OpenRouteService; carretera usa cycling-road. Cambia cómo se priorizan vías según datos de OpenStreetMap.',
  },
]

export function LandingPage() {
  usePageMeta({
    title: 'PedalMap — Crea tu próxima ruta en bici',
    description:
      'Planifica rutas ciclistas reales con mapa, desnivel y tiempo estimado. Guarda y comparte tus salidas.',
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
            Planifica rutas ciclistas, descubre nuevos caminos y prepara tu próxima salida.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 animate-rise" style={{ animationDelay: '200ms' }}>
            <Link to="/route-planner">
              <Button className="!px-6 !py-3 text-base">Crear una ruta</Button>
            </Link>
            <Link to="/explorar">
              <Button variant="ghost" className="!border-white/30 !text-white !px-6 !py-3">
                Explorar
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
            ['1. Elige puntos', 'Busca origen y destino o marca puntos en el mapa.'],
            ['2. Calcula', 'Obtén distancia, desnivel, tiempo y elevación reales.'],
            ['3. Guarda o comparte', 'Inicia sesión para sincronizar y publicar un enlace.'],
          ].map(([title, text]) => (
            <li key={title} className="rounded-3xl bg-white/70 p-5 ring-1 ring-[var(--color-fog)]">
              <h3 className="font-display text-xl font-bold text-[var(--color-forest)]">{title}</h3>
              <p className="mt-2 text-sm text-[var(--color-stone)]">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-[var(--color-panel)] px-4 py-16 text-white md:px-6">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="font-display text-3xl font-extrabold">Crear rutas</h2>
            <p className="mt-3 text-white/75">
              Motor real de routing ciclista. Sin mapas falsos ni botones decorativos.
            </p>
          </div>
          <div>
            <h2 className="font-display text-3xl font-extrabold">Perfil de elevación</h2>
            <p className="mt-3 text-white/75">
              Revisa el desnivel con un gráfico interactivo sincronizado con el mapa.
            </p>
          </div>
          <div>
            <h2 className="font-display text-3xl font-extrabold">Guardar rutas</h2>
            <p className="mt-3 text-white/75">
              Tus recorridos quedan en Firestore asociados a tu cuenta, listos para reabrir.
            </p>
          </div>
          <div>
            <h2 className="font-display text-3xl font-extrabold">Compartir rutas</h2>
            <p className="mt-3 text-white/75">
              Publica un enlace de solo lectura para que otros vean el track y las estadísticas.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <h2 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">
          Próximamente: navegación
        </h2>
        <p className="mt-2 max-w-2xl text-[var(--color-stone)]">
          La arquitectura deja preparada la base para GPS, seguimiento de actividad y navegación
          durante la salida. No está simulada en el MVP.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-10 md:px-6">
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
