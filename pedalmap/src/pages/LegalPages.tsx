import { Link } from 'react-router-dom'
import { usePageMeta } from '@/hooks/usePageMeta'
import { BRAND_EMAILS, PUBLIC_CONTACT_EMAIL } from '@/lib/brandEmails'

const contact = PUBLIC_CONTACT_EMAIL
const hello = BRAND_EMAILS.hello

export function PrivacyPage() {
  usePageMeta({
    title: 'Privacidad | PedalMap',
    description: 'Política de privacidad y minimización de datos de PedalMap (RGPD).',
    path: '/privacidad',
  })

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 pb-24">
      <h1 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">Privacidad</h1>
      <p className="mt-2 text-xs text-[var(--color-stone)]">Última actualización: 10 agosto 2026</p>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-[var(--color-stone)]">
        <p>
          PedalMap (responsable: contacto {contact}) minimiza los datos personales. Solo tratamos lo
          necesario para autenticación, rutas guardadas, preferencias de ciclismo y, si contratas
          Premium, la gestión de la suscripción.
        </p>
        <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">Datos que tratamos</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Cuenta: email, nombre/foto si usas Google, UID de Firebase Auth.</li>
          <li>Rutas y actividades que guardas (geometría, stats, metadatos).</li>
          <li>Preferencias de bici y filtros del planificador.</li>
          <li>Datos de facturación vía Stripe (nosotros no almacenamos números de tarjeta).</li>
        </ul>
        <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">Finalidad y base legal</h2>
        <p>
          Prestación del servicio (contrato), seguridad de la cuenta e interés legítimo en mejorar el
          producto con métricas agregadas solo si das consentimiento de analítica.
        </p>
        <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">Ubicación</h2>
        <p>
          No rastreamos tu ubicación de forma continua. La geolocalización del mapa o del GPS en
          actividad requiere permiso explícito del navegador y se usa en tu dispositivo.
        </p>
        <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">Encargados</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Firebase (Google) — Auth, Firestore, Hosting.</li>
          <li>Cloudflare Workers — proxy de routing y webhooks Stripe.</li>
          <li>OpenRouteService / HeiGIT — cálculo de rutas (coordenadas del trayecto).</li>
          <li>Open-Meteo — viento/meteo por punto de la ruta.</li>
          <li>Stripe — pagos Premium (modo test hasta activar cobro real).</li>
        </ul>
        <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">Conservación y derechos</h2>
        <p>
          Conservamos la cuenta y rutas mientras mantengas el servicio activo. Puedes solicitar
          acceso, rectificación o borrado escribiendo a {contact}.
        </p>
        <p>
          Más detalle sobre cookies en <Link className="underline" to="/cookies">/cookies</Link> y
          condiciones en <Link className="underline" to="/terminos">/terminos</Link>.
        </p>
      </div>
    </main>
  )
}

export function CookiesPage() {
  usePageMeta({
    title: 'Cookies | PedalMap',
    description: 'Información sobre cookies y almacenamiento local en PedalMap.',
    path: '/cookies',
  })
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 pb-24">
      <h1 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">Cookies</h1>
      <p className="mt-2 text-xs text-[var(--color-stone)]">Última actualización: 10 agosto 2026</p>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-[var(--color-stone)]">
        <p>
          Usamos almacenamiento técnico necesario para que la app funcione (sesión Firebase Auth,
          preferencias de UI). Estas no requieren consentimiento.
        </p>
        <p>
          La analítica opcional (eventos agregados como <code>route_created</code>) solo se activa si
          aceptas en el banner de consentimiento. Puedes cambiar de opinión borrando la clave
          <code> pedalmap_consent</code> en el almacenamiento local del navegador o revisitando esta
          página tras limpiar datos del sitio.
        </p>
        <p>
          No usamos cookies de publicidad de terceros en el MVP. Ver también{' '}
          <Link className="underline" to="/privacidad">
            privacidad
          </Link>
          .
        </p>
      </div>
    </main>
  )
}

export function TermsPage() {
  usePageMeta({
    title: 'Términos | PedalMap',
    description: 'Términos de uso de PedalMap.',
    path: '/terminos',
  })
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 pb-24">
      <h1 className="font-display text-3xl font-extrabold text-[var(--color-forest)]">
        Términos de uso
      </h1>
      <p className="mt-2 text-xs text-[var(--color-stone)]">Última actualización: 10 agosto 2026</p>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-[var(--color-stone)]">
        <p>
          PedalMap es una herramienta de planificación ciclista. Al usarla aceptas estas condiciones.
        </p>
        <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">Servicio beta</h2>
        <p>
          El producto puede estar en beta pública. Las funciones Premium en modo test de Stripe no
          implican cobro real hasta que se activen precios live.
        </p>
        <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">Uso responsable</h2>
        <p>
          Las rutas, el viento y el GPS son ayudas. No sustituyen el sentido común, la señalización
          ni las normas de circulación. Tú eres responsable de tu seguridad en carretera o trail.
        </p>
        <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">Cuentas y límites</h2>
        <p>
          El plan Free incluye límites de guardado, creaciones mensuales y filtros. El abuso del API
          de routing puede resultar en limitación temporal (HTTP 429).
        </p>
        <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">Contenido</h2>
        <p>
          Las rutas públicas que compartas pueden verse en Explorar. No publiques datos personales de
          terceros ni contenido ilegal.
        </p>
        <h2 className="font-display text-xl font-bold text-[var(--color-forest)]">Contacto</h2>
        <p>
          Dudas generales: {hello}. Soporte y privacidad: {contact}. Más en{' '}
          <Link className="underline" to="/privacidad">
            /privacidad
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
