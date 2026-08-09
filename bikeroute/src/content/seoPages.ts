import type { SeoPageContent } from '@/pages/SeoContentPage'

export const seoPages: SeoPageContent[] = [
  {
    path: '/crear-ruta-bicicleta',
    title: 'Crear ruta bicicleta online | BikeRoute',
    description:
      'Crea una ruta en bicicleta con mapa, desnivel y tiempo estimado. Planificador ciclista gratuito para empezar en segundos.',
    heading: 'Crear ruta en bicicleta',
    body: [
      'BikeRoute te permite crear una ruta ciclista eligiendo un punto de salida y un destino sobre el mapa. El motor de routing calcula un recorrido adecuado para bicicleta usando datos abiertos.',
      'Verás distancia, desnivel positivo y negativo, dificultad estimada y un perfil de elevación interactivo sincronizado con el mapa.',
      'No necesitas registrarte para probar. Cuando quieras guardar o sincronizar, crea una cuenta gratis.',
    ],
  },
  {
    path: '/planificador-rutas-bici',
    title: 'Planificador de rutas bici | BikeRoute',
    description:
      'Planificador de rutas bici con preferencias de ciclismo, perfiles carretera/MTB/gravel y exportación GPX.',
    heading: 'Planificador de rutas bici',
    body: [
      'El planificador combina búsqueda de lugares, waypoints y preferencias de ciclismo para ayudarte a preparar salidas realistas.',
      'Puedes priorizar carril bici, evitar carreteras principales o buscar menor desnivel según tu forma y tu bici.',
    ],
  },
  {
    path: '/crear-ruta-gpx',
    title: 'Crear ruta GPX para bicicleta | BikeRoute',
    description:
      'Genera y descarga rutas GPX para ciclismo. Importa tracks existentes y visualízalos en el mapa.',
    heading: 'Crear ruta GPX',
    body: [
      'Calcula tu ruta y exporta un GPX válido para GPS o apps de navegación. También puedes importar un GPX para revisar elevación y estadísticas.',
      'La exportación GPX ilimitada forma parte del plan Premium; la importación está disponible para probar el flujo completo.',
    ],
  },
  {
    path: '/rutas-bicicleta-madrid',
    title: 'Rutas bicicleta Madrid | BikeRoute',
    description:
      'Planifica rutas de bicicleta en Madrid y alrededores: distancia, desnivel y perfil de elevación.',
    heading: 'Rutas de bicicleta en Madrid',
    body: [
      'Madrid ofrece salidas muy distintas: Casa de Campo, Monte del Pardo, sierra norte o escapadas a Colmenar y Soto del Real.',
      'Usa el planificador para trazar tu recorrido, revisar el desnivel y guardar la ruta antes de salir.',
    ],
  },
  {
    path: '/rutas-mtb-madrid',
    title: 'Rutas MTB Madrid | BikeRoute',
    description:
      'Crea rutas MTB en Madrid con perfil mountain bike, desnivel y track para tu GPS.',
    heading: 'Rutas MTB en Madrid',
    body: [
      'Selecciona el perfil MTB para priorizar vías más adecuadas a mountain bike según OpenStreetMap.',
      'Revisa siempre el terreno y las restricciones locales antes de rodar.',
    ],
  },
  {
    path: '/rutas-gravel-madrid',
    title: 'Rutas gravel Madrid | BikeRoute',
    description:
      'Planifica rutas gravel por Madrid y la sierra con mapa, elevación y exportación GPX.',
    heading: 'Rutas gravel en Madrid',
    body: [
      'El gravel encaja con caminos mixtos alrededor de Madrid. Configura preferencias y calcula una ruta realista antes de cargar el GPX.',
    ],
  },
]
