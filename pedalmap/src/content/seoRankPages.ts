import type { SeoPageContent } from '@/pages/SeoContentPage'

/** New money-keyword hubs (desnivel, Garmin, Wahoo, Bikemap) + thick city FAQs helpers. */
export const seoRankPages: SeoPageContent[] = [
  {
    path: '/calcular-desnivel-ruta-bici',
    kind: 'intent',
    title: 'Calcular desnivel de una ruta en bici | PedalMap',
    description:
      'Calcula el desnivel positivo y el perfil de elevación de tu ruta en bicicleta antes de salir. Planificador con mapa y GPX en España.',
    heading: 'Calcular el desnivel de una ruta en bici',
    body: [
      'El desnivel decide si una salida es suave, exigente o demasiado para el día. PedalMap calcula el desnivel positivo/negativo y muestra un perfil de elevación sincronizado con el mapa al crear la ruta — sin necesitar un GPS Garmin para planificar.',
      'Cómo hacerlo: abre el planificador, marca origen y destino (o un Objetivo circular por km y metros +), elige tu tipo de bici y calcula. Verás metros de subida, el gráfico de elevación y la composición de superficie. Así evitas “sorpresas” en sierra, Collserola o Navacerrada.',
      'Si ya tienes un track, puedes importar GPX para revisar elevación y estadísticas antes de repetir la ruta. Luego exportas de nuevo a Garmin, Wahoo, OsmAnd u Organic Maps.',
      'Free te deja probar el flujo; Premium quita límites de creaciones, GPX y Objetivo si entrenas varias veces por semana. Guía paso a paso también en el blog.',
    ],
    faqs: [
      {
        q: '¿Cómo se calcula el desnivel en PedalMap?',
        a: 'Al calcular la ruta pedimos elevación al motor de routing y sumamos el desnivel positivo/negativo. El gráfico se sincroniza con el mapa al pasar el cursor o el dedo.',
      },
      {
        q: '¿Puedo fijar un desnivel objetivo sin destino fijo?',
        a: 'Sí, con modo Objetivo (ruta circular): indicas km y metros + deseados alrededor del punto de partida.',
      },
      {
        q: '¿Sirve para Madrid, Barcelona y otras ciudades?',
        a: 'Sí. El mismo flujo cubre toda España; las guías locales ayudan a elegir zonas típicas (Casa de Campo, Collserola, sierra…).',
      },
      {
        q: '¿Necesito Garmin para ver el desnivel?',
        a: 'No para planificar. El desnivel se ve en PedalMap. El GPS sirve luego para seguir el track en carretera.',
      },
    ],
    related: [
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta bicicleta' },
      { to: '/ruta-circular-bicicleta', label: 'Ruta circular / Objetivo' },
      { to: '/blog/calcular-desnivel-ruta-bici', label: 'Tutorial en el blog' },
      { to: '/puerto-navacerrada-bici', label: 'Navacerrada' },
      { to: '/crear-ruta-gpx', label: 'Crear GPX' },
    ],
  },
  {
    path: '/exportar-gpx-garmin',
    kind: 'intent',
    title: 'Exportar GPX a Garmin Edge | PedalMap',
    description:
      'Crea un curso GPX en PedalMap y pásalo a Garmin Connect / Edge. Planificador de rutas bici en España con desnivel y superficie.',
    heading: 'Exportar ruta GPX a Garmin',
    body: [
      'Si tu GPS es un Garmin Edge (o usas Garmin Connect), el flujo habitual es: planificar la ruta → descargar GPX → importar como curso en Connect → sincronizar el dispositivo. PedalMap genera ese GPX tras calcular la salida con tu tipo de bici, desnivel y superficie.',
      'Pasos resumidos: 1) Crea la ruta en el planificador. 2) Exporta GPX (1/semana en Free; ilimitado en Premium). 3) En Garmin Connect: Entrenamiento → Cursos → Importar archivo. 4) Envía el curso al Edge.',
      'Antes de exportar, revisa el perfil de elevación y el viento relativo al sentido de la ruta: así el curso que llega al Garmin ya encaja con lo que quieres rodar. Compatible con el mismo archivo que usarías en Wahoo u OsmAnd.',
      'Guía ampliada en el blog y hub general de GPX si también usas otras apps.',
    ],
    faqs: [
      {
        q: '¿El GPX de PedalMap funciona en Garmin Edge?',
        a: 'Sí. Se importa en Garmin Connect como curso y se sincroniza con el Edge.',
      },
      {
        q: '¿Cuántos GPX gratis puedo bajar?',
        a: '1 por semana en Free. Premium = exportaciones ilimitadas.',
      },
      {
        q: '¿Puedo planificar circular y mandarla al Garmin?',
        a: 'Sí. Modo Objetivo genera la circular; luego exportas el mismo GPX.',
      },
      {
        q: '¿Y si uso Wahoo?',
        a: 'Mismo archivo GPX; el flujo de importación es en la app ELEMNT. Ver guía Wahoo.',
      },
    ],
    related: [
      { to: '/crear-ruta-gpx', label: 'Crear ruta GPX' },
      { to: '/pasar-ruta-wahoo', label: 'Pasar ruta a Wahoo' },
      { to: '/blog/exportar-gpx-garmin', label: 'Tutorial Garmin' },
      { to: '/calcular-desnivel-ruta-bici', label: 'Calcular desnivel' },
      { to: '/premium', label: 'Premium' },
    ],
  },
  {
    path: '/pasar-ruta-wahoo',
    kind: 'intent',
    title: 'Pasar ruta GPX a Wahoo ELEMNT | PedalMap',
    description:
      'Planifica en PedalMap y pasa el GPX a Wahoo ELEMNT. Rutas bici con desnivel, superficie y viento en España.',
    heading: 'Pasar una ruta a Wahoo',
    body: [
      'Wahoo ELEMNT acepta recorridos planificados vía la app ELEMNT (importación de GPX o sincronización). PedalMap es la capa previa: calculas la ruta con perfil de bici, miras desnivel y viento, y descargas el GPX listo para llevar al ciclocomputador.',
      'Flujo típico: crea la ruta en PedalMap → exporta GPX → ábrelo/impórtalo en la app ELEMNT → sincroniza el dispositivo. Free incluye 1 GPX/semana para validar el flujo; Premium quita el límite.',
      'Si también tienes Garmin, el mismo archivo sirve para Connect. OsmAnd y Organic Maps en el móvil abren el GPX sin pasos extra.',
      'Si conectas Wahoo desde PedalMap (cuando esté disponible en tu cuenta), revisa la sección de perfil/GPS; el GPX manual siempre funciona.',
    ],
    faqs: [
      {
        q: '¿Qué archivo necesita Wahoo?',
        a: 'Un GPX de la ruta planificada. PedalMap lo genera tras calcular el recorrido.',
      },
      {
        q: '¿PedalMap sustituye a la app ELEMNT?',
        a: 'No. PedalMap planifica; ELEMNT lleva el curso al dispositivo y navega.',
      },
      {
        q: '¿Puedo usar el mismo GPX en Garmin y Wahoo?',
        a: 'Sí. Es el mismo estándar de archivo.',
      },
    ],
    related: [
      { to: '/exportar-gpx-garmin', label: 'GPX a Garmin' },
      { to: '/crear-ruta-gpx', label: 'Crear ruta GPX' },
      { to: '/blog/pasar-ruta-wahoo', label: 'Tutorial Wahoo' },
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta' },
    ],
  },
  {
    path: '/alternativa-bikemap',
    kind: 'compare',
    title: 'Alternativa a Bikemap en España | PedalMap',
    description:
      'PedalMap como alternativa a Bikemap para planificar rutas bici en España: desnivel, viento, superficie por tipo de bici y GPX.',
    heading: 'Alternativa a Bikemap (España)',
    body: [
      'Bikemap es conocido por mapas y tracks compartidos. Si lo que buscas es planificar tu propia salida en España —con perfil de bici, desnivel claro, viento relativo a la ruta y GPX a Garmin/Wahoo—, PedalMap está pensado para ese flujo previo a rodar.',
      'No pretendemos ser un clon de la red social de tracks. Priorizamos un planificador en español (pedalmap.es), freemium transparente y datos útiles (superficie e idoneidad según carretera, gravel, MTB, urbana o e-bike).',
      'Prueba Free sin tarjeta. Compara también con Komoot y Strava si vienes de esas apps: cada una cubre un hueco distinto; PedalMap es la capa de planificación.',
    ],
    faqs: [
      {
        q: '¿PedalMap sustituye a Bikemap?',
        a: 'Si tu prioridad es crear A→B o circulares con desnivel/viento/GPX en España, puede ser tu herramienta principal. Si buscas sobre todo explorar tracks ajenos, Bikemap o Komoot siguen siendo referencias.',
      },
      {
        q: '¿Puedo exportar a GPS?',
        a: 'Sí, via GPX a Garmin, Wahoo, OsmAnd u Organic Maps.',
      },
      {
        q: '¿Hay alternativa a Komoot también?',
        a: 'Sí: ver la guía Alternativa a Komoot en España.',
      },
    ],
    related: [
      { to: '/alternativa-komoot', label: 'Alternativa a Komoot' },
      { to: '/alternativa-strava-planificar', label: 'vs Strava planificar' },
      { to: '/blog/alternativa-bikemap', label: 'Comparativa blog' },
      { to: '/planificador-rutas-bici', label: 'Planificador' },
      { to: '/que-es-pedalmap', label: 'Qué es PedalMap' },
    ],
  },
]
