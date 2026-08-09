import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { seoPages } from '@/content/seoPages'
import { usePageMeta } from '@/hooks/usePageMeta'

export function ExplorePage() {
  usePageMeta({
    title: 'Explorar rutas ciclistas | BikeRoute',
    description: 'Descubre guías y planifica rutas de bicicleta, MTB y gravel.',
    path: '/explorar',
  })

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 pb-24">
      <h1 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">Explorar</h1>
      <p className="mt-2 text-[var(--color-stone)]">
        Guías útiles para planificar. El descubrimiento comunitario llegará en fases posteriores.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {seoPages.map((page) => (
          <Link
            key={page.path}
            to={page.path}
            className="rounded-3xl bg-white/80 p-5 ring-1 ring-[var(--color-fog)] transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">
              {page.heading}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-stone)]">{page.description}</p>
          </Link>
        ))}
      </div>
      <Link to="/route-planner" className="mt-8 inline-block">
        <Button>Crear mi ruta</Button>
      </Link>
    </main>
  )
}
