import { usePageMeta } from '@/hooks/usePageMeta'

export function PrivacyPage() {
  usePageMeta({
    title: 'Privacidad | BikeRoute',
    description: 'Política de privacidad y minimización de datos de BikeRoute (RGPD).',
    path: '/privacidad',
  })

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 pb-24 prose-like">
      <h1 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">Privacidad</h1>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--color-stone)]">
        <p>
          BikeRoute minimiza los datos personales. Solo almacenamos lo necesario para autenticación,
          rutas guardadas y preferencias de ciclismo.
        </p>
        <p>
          No rastreamos tu ubicación de forma continua. La geolocalización del mapa requiere tu
          permiso explícito del navegador y se usa solo en el dispositivo.
        </p>
        <p>
          Analytics se prepara con eventos agregados (`route_created`, `route_saved`, etc.) y no debe
          activarse con cookies no esenciales sin consentimiento.
        </p>
        <p>
          Puedes solicitar acceso o borrado de tus datos contactando al responsable del tratamiento
          cuando el producto esté en producción.
        </p>
      </div>
    </main>
  )
}

export function CookiesPage() {
  usePageMeta({
    title: 'Cookies | BikeRoute',
    description: 'Información sobre cookies en BikeRoute.',
    path: '/cookies',
  })
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 pb-24">
      <h1 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">Cookies</h1>
      <p className="mt-4 text-sm text-[var(--color-stone)]">
        En el MVP priorizamos cookies técnicas necesarias para autenticación. Las cookies de
        analítica o marketing solo se activarán con consentimiento.
      </p>
    </main>
  )
}
