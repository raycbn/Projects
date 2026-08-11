import type { SeoPageContent } from '@/pages/SeoContentPage'

export const seoPages: SeoPageContent[] = [
  {
    path: '/crear-ruta-bicicleta',
    title: 'Crear ruta bicicleta online | PedalMap',
    description:
      'Crea una ruta en bicicleta online con mapa, desnivel, viento y superficie. Planificador ciclista gratuito en España — empieza en segundos.',
    heading: 'Crear ruta en bicicleta',
    body: [
      'PedalMap es un planificador de rutas de bicicleta para crear salidas reales en España: eliges salida y destino (o un Objetivo circular), el tipo de bici y calculas un recorrido con distancia, tiempo, desnivel y composición de suelo.',
      'A diferencia de un GPS genérico, el motor tiene en cuenta carretera, urbana, gravel, MTB o e-bike para priorizar vías más adecuadas. Verás un % de idoneidad y un perfil de elevación sincronizado con el mapa.',
      'No necesitas cuenta para probar. Cuando quieras guardar rutas, avisos de viento o sincronizar, crea una cuenta Free. Premium quita los límites de creaciones, GPX y Objetivo.',
    ],
    related: [
      { to: '/planificador-rutas-bici', label: 'Planificador de rutas bici' },
      { to: '/crear-ruta-gpx', label: 'Crear ruta GPX' },
      { to: '/rutas-bicicleta-madrid', label: 'Rutas bici Madrid' },
    ],
  },
  {
    path: '/planificador-rutas-bici',
    title: 'Planificador de rutas bici | PedalMap',
    description:
      'Planificador de rutas bici con perfiles carretera/MTB/gravel, viento, desnivel y exportación GPX. Hecho para ciclistas en España.',
    heading: 'Planificador de rutas bici',
    body: [
      'El planificador combina búsqueda de lugares, waypoints y preferencias de ciclismo para preparar salidas realistas: menos sorpresas de asfalto o pista cuando no las quieres.',
      'Puedes priorizar carril bici, evitar carreteras principales o buscar menor desnivel según tu forma. Tras calcular, revisas viento relativo a la ruta, superficie y exportas GPX o abres la navegación.',
      'Empieza Free. Si entrenas a menudo o quieres Objetivo ilimitado y avisos, Premium incluye 7 días de prueba en el plan anual.',
    ],
    related: [
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta bicicleta' },
      { to: '/crear-ruta-gpx', label: 'Exportar GPX' },
      { to: '/rutas-gravel-madrid', label: 'Gravel Madrid' },
    ],
  },
  {
    path: '/crear-ruta-gpx',
    title: 'Crear ruta GPX para bicicleta | PedalMap',
    description:
      'Genera y descarga rutas GPX para ciclismo. Compatible con Garmin, Wahoo, OsmAnd y Organic Maps. Prueba Free, ilimitado en Premium.',
    heading: 'Crear ruta GPX',
    body: [
      'Calcula tu ruta en PedalMap y exporta un GPX válido para GPS o apps de navegación. También puedes importar un track para revisar elevación y estadísticas antes de salir.',
      'La exportación GPX ilimitada forma parte de Premium; Free incluye 1 descarga por semana para validar el flujo completo.',
      'Si usas Garmin Connect o Wahoo, el GPX se carga como actividad/recorrido planificado. En móvil, OsmAnd y Organic Maps abren el mismo archivo sin fricción.',
    ],
    related: [
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta bicicleta' },
      { to: '/planificador-rutas-bici', label: 'Planificador' },
      { to: '/premium', label: 'Ver Premium' },
    ],
  },
  {
    path: '/rutas-bicicleta-madrid',
    title: 'Rutas bicicleta Madrid | PedalMap',
    description:
      'Planifica rutas de bicicleta en Madrid y alrededores: Casa de Campo, sierra, desnivel y GPX con PedalMap.',
    heading: 'Rutas de bicicleta en Madrid',
    body: [
      'Madrid ofrece salidas muy distintas en poca distancia: Casa de Campo y Madrid Río para rodajes urbanos, Monte del Pardo y la sierra norte (Colmenar, Soto del Real, Manzanares) para más desnivel, o escapadas a la zona oeste hacia El Escorial.',
      'Con PedalMap trazas el recorrido eligiendo tu bici, revisas el desnivel real y la superficie, y guardas o exportas GPX antes de salir. Ideal para preparar el fin de semana sin improvisar en el asfalto.',
      'Si buscas más técnico, mira también rutas MTB o gravel en Madrid. El mismo planificador sirve para los tres perfiles.',
    ],
    related: [
      { to: '/rutas-mtb-madrid', label: 'MTB Madrid' },
      { to: '/rutas-gravel-madrid', label: 'Gravel Madrid' },
      { to: '/rutas-bicicleta-barcelona', label: 'Rutas bici Barcelona' },
    ],
  },
  {
    path: '/rutas-mtb-madrid',
    title: 'Rutas MTB Madrid | PedalMap',
    description:
      'Crea rutas MTB en Madrid con perfil mountain bike, desnivel y track GPX para tu GPS.',
    heading: 'Rutas MTB en Madrid',
    body: [
      'Selecciona el perfil MTB para priorizar vías más adecuadas a mountain bike según datos abiertos (OpenStreetMap / Valhalla). Útil en sierra norte, zonas de Cercedilla o caminos alrededor de Hoyo y Moralzarzal.',
      'Revisa siempre el terreno, el estado tras lluvia y las restricciones locales (espacios protegidos, vedados) antes de rodar. PedalMap te da el track y el desnivel; el criterio en el monte es tuyo.',
      'Exporta GPX a tu GPS o navega desde el móvil. Premium desbloquea creaciones y exportaciones ilimitadas si entrenas varias veces por semana.',
    ],
    related: [
      { to: '/rutas-bicicleta-madrid', label: 'Bici Madrid' },
      { to: '/rutas-gravel-madrid', label: 'Gravel Madrid' },
      { to: '/crear-ruta-gpx', label: 'Crear GPX' },
    ],
  },
  {
    path: '/rutas-gravel-madrid',
    title: 'Rutas gravel Madrid | PedalMap',
    description:
      'Planifica rutas gravel por Madrid y la sierra con mapa, elevación, viento y exportación GPX.',
    heading: 'Rutas gravel en Madrid',
    body: [
      'El gravel encaja con caminos mixtos alrededor de Madrid: pistas hacia la sierra, conexiones entre pueblos y tramos de tierra compacta sin necesitar full MTB.',
      'Configura el perfil gravel, calcula una ruta realista y mira la composición de superficie y el viento relativo al recorrido. Así evitas acabar en autovía o en un singletrack demasiado técnico.',
      'Guarda la salida, compártela o llévatela en GPX. Empieza Free y pasa a Premium cuando quieras sin límites.',
    ],
    related: [
      { to: '/rutas-bicicleta-madrid', label: 'Bici Madrid' },
      { to: '/rutas-mtb-madrid', label: 'MTB Madrid' },
      { to: '/planificador-rutas-bici', label: 'Planificador' },
    ],
  },
  {
    path: '/rutas-bicicleta-barcelona',
    title: 'Rutas bicicleta Barcelona | PedalMap',
    description:
      'Planifica rutas de bicicleta en Barcelona y alrededores: costa, Collserola, desnivel y GPX con PedalMap.',
    heading: 'Rutas de bicicleta en Barcelona',
    body: [
      'Barcelona combina paseos costeros, subidas a Collserola y escapadas hacia el Maresme o el Baix Llobregat. Con PedalMap eliges el tipo de bici, trazas salida y llegada y revisas desnivel y superficie antes de salir.',
      'Útil tanto para rodajes urbanos con carril bici como para salidas de fin de semana con más metros positivos. Exporta GPX o navega desde el móvil.',
      'Si vienes de Madrid u otra ciudad, el mismo flujo te sirve: Free para probar, Premium cuando entrenes a menudo.',
    ],
    related: [
      { to: '/rutas-bicicleta-madrid', label: 'Rutas bici Madrid' },
      { to: '/rutas-bicicleta-valencia', label: 'Rutas bici Valencia' },
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta' },
    ],
  },
  {
    path: '/rutas-bicicleta-valencia',
    title: 'Rutas bicicleta Valencia | PedalMap',
    description:
      'Planifica rutas de bicicleta en Valencia: Turia, huerta, costa y desnivel con mapa y GPX en PedalMap.',
    heading: 'Rutas de bicicleta en Valencia',
    body: [
      'Valencia es muy ciclista: el antiguo cauce del Turia, la huerta y la costa permiten rodajes planos y salidas más largas sin inventar el recorrido sobre la marcha.',
      'Con PedalMap calculas la ruta según tu bici, miras viento y elevación, y te llevas el GPX al GPS o al móvil. Ideal para preparar grupetas o entrenos solo.',
      'Prueba Free y, si quieres Objetivo circular o GPX ilimitado, mira Premium con 7 días de prueba en el plan anual.',
    ],
    related: [
      { to: '/rutas-bicicleta-barcelona', label: 'Rutas bici Barcelona' },
      { to: '/rutas-bicicleta-sevilla', label: 'Rutas bici Sevilla' },
      { to: '/planificador-rutas-bici', label: 'Planificador' },
    ],
  },
  {
    path: '/rutas-bicicleta-sevilla',
    title: 'Rutas bicicleta Sevilla | PedalMap',
    description:
      'Planifica rutas de bicicleta en Sevilla y alrededores con mapa, desnivel, viento y exportación GPX.',
    heading: 'Rutas de bicicleta en Sevilla',
    body: [
      'Sevilla y su entorno ofrecen rodajes suaves junto al Guadalquivir, conexiones por carril bici y escapadas hacia Aljarafe o la campiña cuando buscas más kilómetros.',
      'PedalMap te ayuda a trazar la salida con el perfil de bici adecuado, revisar superficie y viento, y guardar o exportar GPX antes de salir con el calor del día.',
      'Empieza sin cuenta. Cuando quieras guardar varias rutas al mes o avisos de viento, crea usuario Free o Premium.',
    ],
    related: [
      { to: '/rutas-bicicleta-valencia', label: 'Rutas bici Valencia' },
      { to: '/rutas-bicicleta-madrid', label: 'Rutas bici Madrid' },
      { to: '/crear-ruta-gpx', label: 'Crear GPX' },
    ],
  },
]
