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
  {
    path: '/rutas-bicicleta-bilbao',
    title: 'Rutas bicicleta Bilbao | PedalMap',
    description:
      'Planifica rutas de bicicleta en Bilbao y Bizkaia: ría, costa, desnivel y GPX con PedalMap.',
    heading: 'Rutas de bicicleta en Bilbao',
    body: [
      'Bilbao y alrededores mezclan paseos junto a la ría, subidas cortas hacia los montes cercanos y escapadas hacia la costa de Bizkaia. Con PedalMap eliges el tipo de bici y ves desnivel y superficie antes de salir.',
      'Útil para rodajes urbanos y para salidas de fin de semana con más metros. Exporta GPX a Garmin/Wahoo o navega desde el móvil.',
      'Empieza Free; si preparas varias rutas a la semana, Premium quita los límites de creaciones y GPX.',
    ],
    related: [
      { to: '/rutas-bicicleta-santander', label: 'Rutas Santander' },
      { to: '/rutas-bicicleta-zaragoza', label: 'Rutas Zaragoza' },
      { to: '/blog/primera-ruta-pedalmap', label: 'Primera ruta' },
    ],
  },
  {
    path: '/rutas-bicicleta-zaragoza',
    title: 'Rutas bicicleta Zaragoza | PedalMap',
    description:
      'Planifica rutas de bicicleta en Zaragoza: Ebro, canal, rodajes planos y escapadas con mapa y GPX.',
    heading: 'Rutas de bicicleta en Zaragoza',
    body: [
      'Zaragoza encaja muy bien con rodajes largos y relativamente planos junto al Ebro y el Canal Imperial. PedalMap te ayuda a trazar la salida, mirar viento (clave en el valle) y desnivel real.',
      'Elige perfil carretera o gravel según el firme que quieras. Guarda la ruta o exporta GPX para la grupeta.',
      'Prueba sin cuenta y crea usuario Free cuando quieras guardar varias salidas.',
    ],
    related: [
      { to: '/rutas-bicicleta-madrid', label: 'Rutas Madrid' },
      { to: '/rutas-bicicleta-bilbao', label: 'Rutas Bilbao' },
      { to: '/blog/viento-en-la-ruta', label: 'Viento en la ruta' },
    ],
  },
  {
    path: '/rutas-bicicleta-malaga',
    title: 'Rutas bicicleta Málaga | PedalMap',
    description:
      'Planifica rutas de bicicleta en Málaga y la Costa del Sol: costa, montaña cercana, desnivel y GPX.',
    heading: 'Rutas de bicicleta en Málaga',
    body: [
      'Málaga ofrece costa para rodajes y, a pocos kilómetros, puertos y carreteras con desnivel serio hacia el interior. Define si quieres llano playero o metros positivos antes de calcular.',
      'Con PedalMap trazas origen/destino, eliges el perfil de bici y revisas elevación y superficie. Ojo con el calor: planifica horarios y lleva agua.',
      'Exporta GPX o usa la navegación móvil. Free para empezar; Premium si sales a menudo.',
    ],
    related: [
      { to: '/rutas-bicicleta-granada', label: 'Rutas Granada' },
      { to: '/rutas-bicicleta-sevilla', label: 'Rutas Sevilla' },
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta' },
    ],
  },
  {
    path: '/rutas-bicicleta-granada',
    title: 'Rutas bicicleta Granada | PedalMap',
    description:
      'Planifica rutas de bicicleta en Granada: Vega, sierra y desnivel real con mapa y exportación GPX.',
    heading: 'Rutas de bicicleta en Granada',
    body: [
      'Granada premia mirar el desnivel: la Vega permite rodajes más suaves y en cuanto tiras hacia sierra los metros suben rápido. PedalMap muestra el perfil antes de comprometerte.',
      'Elige carretera o MTB/gravel según la zona. Calcula, revisa superficie y viento, y guarda o exporta GPX.',
      'Ideal para preparar entrenos de subida sin improvisar el recorrido el mismo día.',
    ],
    related: [
      { to: '/rutas-bicicleta-malaga', label: 'Rutas Málaga' },
      { to: '/blog/calcular-desnivel-ruta-bici', label: 'Calcular desnivel' },
      { to: '/route-planner', label: 'Planificador' },
    ],
  },
  {
    path: '/rutas-bicicleta-alicante',
    title: 'Rutas bicicleta Alicante | PedalMap',
    description:
      'Planifica rutas de bicicleta en Alicante: costa, interior y desnivel con PedalMap y GPX.',
    heading: 'Rutas de bicicleta en Alicante',
    body: [
      'Alicante combina paseos costeros con escapadas hacia el interior donde el desnivel aparece en cuanto dejas la primera línea. Con PedalMap defines la salida y ves metros y suelo.',
      'Perfil carretera para asfalto; gravel si encadenas caminos. Revisa el viento, muy presente en tramos abiertos.',
      'Empieza Free y pasa a Premium cuando necesites más GPX u Objetivo circular.',
    ],
    related: [
      { to: '/rutas-bicicleta-valencia', label: 'Rutas Valencia' },
      { to: '/rutas-bicicleta-murcia', label: 'Rutas Murcia' },
      { to: '/blog/viento-en-la-ruta', label: 'Viento' },
    ],
  },
  {
    path: '/rutas-bicicleta-murcia',
    title: 'Rutas bicicleta Murcia | PedalMap',
    description:
      'Planifica rutas de bicicleta en Murcia y alrededores con mapa, desnivel, viento y GPX.',
    heading: 'Rutas de bicicleta en Murcia',
    body: [
      'Murcia permite rodajes por huerta y conexiones hacia costa o interior según el desnivel que busques. PedalMap te ayuda a cuadrar kilómetros y metros antes de salir con calor.',
      'Calcula con el tipo de bici adecuado, mira superficie y exporta GPX al GPS o al móvil.',
      'Guarda tus salidas favoritas en Free y sube a Premium si entrenas con frecuencia.',
    ],
    related: [
      { to: '/rutas-bicicleta-alicante', label: 'Rutas Alicante' },
      { to: '/rutas-bicicleta-valencia', label: 'Rutas Valencia' },
      { to: '/crear-ruta-gpx', label: 'Crear GPX' },
    ],
  },
  {
    path: '/rutas-bicicleta-santander',
    title: 'Rutas bicicleta Santander | PedalMap',
    description:
      'Planifica rutas de bicicleta en Santander y Cantabria: costa, desnivel y GPX con PedalMap.',
    heading: 'Rutas de bicicleta en Santander',
    body: [
      'Santander y Cantabria ofrecen costa dura de viento y carreteras con subidas frecuentes. Planificar desnivel y exposición al viento aquí no es opcional.',
      'Con PedalMap trazas la ruta, eliges el perfil y revisas elevación antes de salir. Lleva capas: el tiempo cambia rápido.',
      'Exporta GPX o navega desde el móvil. Empieza Free en pedalmap.es.',
    ],
    related: [
      { to: '/rutas-bicicleta-bilbao', label: 'Rutas Bilbao' },
      { to: '/blog/viento-en-la-ruta', label: 'Viento en la ruta' },
      { to: '/planificador-rutas-bici', label: 'Planificador' },
    ],
  },
]
