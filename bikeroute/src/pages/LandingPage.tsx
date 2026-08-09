import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

const faqs = [
  {
    q: '¿Cómo crear una ruta en bicicleta?',
    a: 'Abre el planificador, indica dónde empiezas y dónde quieres llegar, elige el tipo de bici y pulsa Crear ruta. BikeRoute calcula un recorrido ciclista con distancia, desnivel y tiempo estimado.',
  },
  {
    q: '¿Cómo planificar una ruta ciclista?',
    a: 'Define salida y destino, ajusta preferencias (carril bici, menos desnivel, evitar principales) y revisa el perfil de elevación antes de salir.',
  },
  {
    q: '¿Cómo crear una ruta GPX?',
    a: 'Calcula la ruta y, con Premium, descarga el archivo GPX para usarlo en tu GPS o app de navegación. También puedes importar un GPX existente.',
  },
  {
    q: '¿Cómo calcular el desnivel de una ruta?',
    a: 'Al calcular la ruta, BikeRoute obtiene la geometría y el perfil de elevación del proveedor de routing y muestra desnivel positivo, negativo, máximo y mínimo.',
  },
  {
    q: '¿Cómo encontrar rutas de bicicleta cerca de mí?',
    a: 'Usa la geolocalización del mapa o busca tu municipio. En fases posteriores añadiremos descubrimiento de rutas públicas cercanas.',
  },
  {
    q: '¿Cómo crear una ruta circular en bicicleta?',
    a: 'La arquitectura ya contempla rutas circulares por distancia aproximada. El algoritmo avanzado llegará en una fase posterior; mientras tanto puedes usar ida y vuelta.',
  },
  {
    q: '¿Cómo planificar una ruta MTB?',
    a: 'Selecciona el perfil MTB en el planificador. El motor prioriza vías adecuadas para mountain bike según los datos de OpenStreetMap del proveedor.',
  },
  {
    q: '¿Cuál es la mejor aplicación para crear rutas en bici?',
    a: 'Depende de tu uso. BikeRoute se centra en planificar rápido, ver desnivel con claridad, guardar y exportar GPX, sin obligarte a registrarte para probar.',
  },
]

export function LandingPage() {
  return (
    <main>
      <section className="relative min-h-[88vh] overflow-hidden topo-grid">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              'linear-gradient(120deg, rgba(7,21,16,0.72), rgba(13,59,43,0.35)), url(https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=2000&q=80)',
          }}
          role="img"
          aria-label="Ciclista en carretera entre montañas"
        />
        <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-end px-4 pb-16 pt-24 md:justify-center md:px-6">
          <p className="animate-rise font-display text-5xl font-extrabold tracking-tight text-white drop-shadow md:text-7xl">
            BikeRoute
          </p>
          <h1 className="mt-4 max-w-2xl animate-rise text-balance text-3xl font-semibold text-white md:text-4xl" style={{ animationDelay: '80ms' }}>
            Crea tu próxima ruta en bici
          </h1>
          <p className="mt-4 max-w-xl animate-rise text-lg text-white/85" style={{ animationDelay: '140ms' }}>
            Planifica rutas, descubre nuevos caminos y descarga tu recorrido en segundos.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 animate-rise" style={{ animationDelay: '200ms' }}>
            <Link to="/route-planner">
              <Button className="!px-6 !py-3 text-base">Crear una ruta</Button>
            </Link>
            <Link to="/crear-ruta-bicicleta">
              <Button variant="ghost" className="!border-white/30 !text-white !px-6 !py-3">
                Cómo funciona
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <h2 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">Cómo funciona</h2>
        <p className="mt-2 max-w-2xl text-[var(--color-stone)]">
          Tres pasos para salir a rodar con la ruta clara.
        </p>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            ['1. Elige puntos', 'Busca inicio y destino o usa el mapa.'],
            ['2. Calcula', 'Obtén distancia, desnivel, tiempo y elevación.'],
            ['3. Guarda o exporta', 'Sincroniza en la nube o descarga GPX.'],
          ].map(([title, text]) => (
            <li key={title} className="rounded-3xl bg-white/70 p-5 ring-1 ring-[var(--color-fog)]">
              <h3 className="font-display text-xl font-bold text-[var(--color-forest)]">{title}</h3>
              <p className="mt-2 text-sm text-[var(--color-stone)]">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-[var(--color-panel)] px-4 py-16 text-white md:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-3xl font-extrabold">Hecho para ciclistas</h2>
          <p className="mt-2 max-w-2xl text-white/70">
            Perfiles para carretera, MTB, gravel, urbana y e-bike. Preferencias reales, no relleno.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {['Carretera', 'MTB', 'Gravel', 'Urbana', 'E-bike'].map((bike) => (
              <div key={bike} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center font-semibold">
                {bike}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <h2 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">Premium cuando lo necesites</h2>
        <p className="mt-2 text-[var(--color-stone)]">
          Empieza gratis. Sube a Premium para GPX ilimitado, filtros avanzados y rutas circulares.
        </p>
        <Link to="/premium" className="mt-6 inline-block">
          <Button variant="secondary">Ver Premium</Button>
        </Link>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20 md:px-6">
        <h2 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">Preguntas frecuentes</h2>
        <div className="mt-6 space-y-3">
          {faqs.map((item) => (
            <details key={item.q} className="group rounded-2xl bg-white/80 p-4 ring-1 ring-[var(--color-fog)]">
              <summary className="cursor-pointer list-none font-semibold text-[var(--color-forest)]">
                {item.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-stone)]">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  )
}
