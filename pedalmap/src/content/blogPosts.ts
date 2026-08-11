export interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  readMinutes: number
  tags: string[]
  /** Short hook for Instagram/TikTok/Reels */
  socialHook: string
  /** Caption ready to paste (IG/TikTok/YT community) */
  socialCaption: string
  body: string[]
  relatedPaths?: Array<{ to: string; label: string }>
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'exportar-gpx-garmin',
    title: 'Cómo exportar una ruta GPX a Garmin desde PedalMap',
    description:
      'Pasa tu ruta de PedalMap a Garmin Connect o al Edge en minutos: exporta GPX, cárgala y sal a rodar.',
    date: '2026-08-11',
    readMinutes: 4,
    tags: ['GPX', 'Garmin'],
    socialHook: 'GPX de PedalMap → Garmin en 60 segundos',
    socialCaption:
      '¿Ruta lista en el móvil y el Edge vacío? En PedalMap calculas, exportas GPX y lo subes a Garmin Connect (o lo pasas por cable). Free incluye 1 GPX/semana; Premium ilimitado.\n\nPrueba: pedalmap.es/crear-ruta-gpx\n\n#ciclismo #garmin #gpx #pedalmap',
    body: [
      'Si ya tienes la salida pensada en PedalMap, el último paso es llevarla al GPS. El formato estándar es GPX: lo entienden Garmin Connect, la mayoría de Edge y relojes compatibles.',
      '1) Abre el planificador en pedalmap.es, crea la ruta con tu tipo de bici y revisa desnivel y superficie. 2) En la ruta lista, exporta GPX. 3) En Garmin Connect (web o app): Guarda → Importar → elige el archivo. 4) Sincroniza el dispositivo.',
      'Consejo: mira el track en el mapa de Connect antes de salir. Si un tramo no te convence, vuelve a PedalMap, ajusta waypoints y vuelve a exportar. En Free tienes 1 GPX por semana; en Premium, ilimitado.',
    ],
    relatedPaths: [
      { to: '/crear-ruta-gpx', label: 'Crear ruta GPX' },
      { to: '/blog/pasar-ruta-wahoo', label: 'Pasar ruta a Wahoo' },
      { to: '/route-planner', label: 'Abrir planificador' },
    ],
  },
  {
    slug: 'pasar-ruta-wahoo',
    title: 'Cómo pasar una ruta de PedalMap a Wahoo',
    description:
      'Exporta GPX desde PedalMap e impórtalo en Wahoo ELEMNT / app para seguir el track en tu salida.',
    date: '2026-08-11',
    readMinutes: 3,
    tags: ['GPX', 'Wahoo'],
    socialHook: 'De PedalMap a Wahoo sin líos',
    socialCaption:
      'Calcula en PedalMap (suelo + viento + desnivel) → exporta GPX → impórtalo en la app Wahoo. Listo para el ELEMNT.\n\npedalmap.es/crear-ruta-gpx\n\n#wahoo #ciclismo #gpx',
    body: [
      'Wahoo trabaja muy bien con rutas planificadas en GPX. El flujo desde PedalMap es directo: calculas la salida con el perfil de bici que uses, exportas el archivo y lo importas en la app Wahoo o en el ecosistema ELEMNT.',
      'Revisa en PedalMap la idoneidad de superficie y el viento relativo a la ruta antes de exportar: te ahorra sorpresas en carretera o pista. Luego sincroniza el dispositivo y confirma que el track aparece como ruta/recorrido.',
      'Si entrenas varias veces por semana, Premium evita el tope de exportaciones Free.',
    ],
    relatedPaths: [
      { to: '/blog/exportar-gpx-garmin', label: 'GPX a Garmin' },
      { to: '/crear-ruta-gpx', label: 'Crear GPX' },
      { to: '/premium', label: 'Premium' },
    ],
  },
  {
    slug: 'ruta-circular-objetivo',
    title: 'Cómo crear una ruta circular (Objetivo) en PedalMap',
    description:
      'Genera una salida circular por kilómetros y desnivel con el modo Objetivo: 1 prueba Free al mes, ilimitado en Premium.',
    date: '2026-08-11',
    readMinutes: 4,
    tags: ['Objetivo', 'Circular'],
    socialHook: '¿X km y Y de desnivel? Objetivo lo traza',
    socialCaption:
      'No tienes destino fijo: solo quieres 60 km y ~800 m+. Modo Objetivo en PedalMap → circular realista según tu bici.\n\n1 prueba Free/mes · Premium ilimitado\npedalmap.es\n\n#ciclismo #entreno #pedalmap',
    body: [
      'El modo Objetivo sirve cuando no vas de A a B, sino que quieres una circular con distancia y desnivel concretos desde un punto de partida.',
      'Elige Objetivo, indica el inicio, los kilómetros y el desnivel deseado, y el tipo de bici. PedalMap genera candidatos con Valhalla primero (superficie + perfil), para que la circular no te meta por autovía o por un singletrack imposible en carretera.',
      'Free incluye 1 prueba al mes. Si preparas entrenos a menudo, Premium deja Objetivo ilimitado y puedes iterar hasta dar con la salida que quieres.',
    ],
    relatedPaths: [
      { to: '/route-planner', label: 'Probar Objetivo' },
      { to: '/premium', label: 'Ver Premium' },
      { to: '/blog/primera-ruta-pedalmap', label: 'Primera ruta' },
    ],
  },
  {
    slug: 'viento-en-la-ruta',
    title: 'Por qué mirar el viento antes de salir en bici',
    description:
      'Cómo usar el viento relativo a la ruta en PedalMap para no comerse el temporal de cara en el tramo largo.',
    date: '2026-08-11',
    readMinutes: 3,
    tags: ['Viento', 'Planificación'],
    socialHook: 'El viento no se ve en Strava hasta que duele',
    socialCaption:
      'Misma ruta, distinto día: 20 km “fáciles” se vuelven un muro. En PedalMap miras el viento relativo al track antes de salir.\n\npedalmap.es\n\n#ciclismo #viento #entreno',
    body: [
      'El viento de cara en un falso llano cansa más que un puerto corto. Por eso PedalMap muestra información de viento en el contexto de la ruta: no solo “hace viento”, sino cómo empuja respecto al sentido en el que ruedas.',
      'Úsalo para elegir dirección de salida, acortar el tramo expuesto o mover el día de la grupeta. Combínalo con el perfil de elevación: un descenso con viento lateral exige más atención.',
      'Si guardas rutas y activas avisos (Premium / configuración de alertas), puedes enterarte cuando una salida favorita pinta especialmente bien.',
    ],
    relatedPaths: [
      { to: '/planificador-rutas-bici', label: 'Planificador' },
      { to: '/blog/calcular-desnivel-ruta-bici', label: 'Calcular desnivel' },
      { to: '/premium', label: 'Premium' },
    ],
  },
  {
    slug: 'free-vs-premium',
    title: 'PedalMap Free vs Premium: qué incluye cada plan',
    description:
      'Límites Free, qué desbloquea Premium, trial de 7 días en el plan anual y cuándo merece la pena subir.',
    date: '2026-08-11',
    readMinutes: 3,
    tags: ['Premium', 'Free'],
    socialHook: 'Free para probar. Premium cuando ya entrenas en serio.',
    socialCaption:
      'Free: rutas de verdad, 1 GPX/semana, 1 Objetivo/mes. Premium: sin techos + trial 7 días en el anual (39,99 €/año).\n\npedalmap.es/premium\n\n#pedalmap #ciclismo',
    body: [
      'Free está pensado para probar el flujo completo: crear rutas, ver desnivel, superficie y viento, guardar un cupo mensual y exportar 1 GPX a la semana, más 1 Objetivo al mes.',
      'Premium quita techos de creaciones, GPX y Objetivo, y encaja si sales varias veces por semana o preparas grupetas. El plan anual incluye 7 días de prueba; el mensual está disponible sin ese trial.',
      'Empieza Free. Si te frenas por el límite de GPX u Objetivo, ahí es cuando Premium compensa.',
    ],
    relatedPaths: [
      { to: '/premium', label: 'Ir a Premium' },
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta' },
      { to: '/blog/ruta-circular-objetivo', label: 'Modo Objetivo' },
    ],
  },
  {
    slug: 'ruta-ejemplo-madrid',
    title: 'Ejemplo: planificar una salida en bici por Madrid',
    description:
      'Cómo usar PedalMap para preparar una ruta por Madrid (Casa de Campo, sierra o ciudad) con desnivel y GPX.',
    date: '2026-08-11',
    readMinutes: 4,
    tags: ['Madrid', 'Ejemplo'],
    socialHook: 'Madrid en bici sin improvisar el desnivel',
    socialCaption:
      'Casa de Campo, Madrid Río o sierra: en PedalMap trazas, miras metros y suelo, y te llevas el GPX.\n\nGuía: pedalmap.es/rutas-bicicleta-madrid\n\n#madrid #ciclismo #bici',
    body: [
      'Madrid cambia mucho en 20 km: llano urbano, Casa de Campo o subidas hacia la sierra. Antes de quedar, define si quieres rodaje suave o desnivel serio.',
      'En PedalMap: busca el punto de inicio, el destino (o usa Objetivo), elige carretera / gravel / MTB y calcula. Revisa el gráfico de elevación y la composición de superficie. Si pinta demasiado duro, acorta o cambia preferencias.',
      'Guarda la ruta o exporta GPX. Para ideas de zona, mira la guía de rutas en Madrid y las variantes MTB/gravel.',
    ],
    relatedPaths: [
      { to: '/rutas-bicicleta-madrid', label: 'Rutas Madrid' },
      { to: '/rutas-gravel-madrid', label: 'Gravel Madrid' },
      { to: '/route-planner', label: 'Planificador' },
    ],
  },
  {
    slug: 'elegir-perfil-bici',
    title: 'Carretera, gravel o MTB: qué perfil elegir en PedalMap',
    description:
      'El tipo de bici cambia el routing. Aprende cuándo usar cada perfil para no acabar en el suelo equivocado.',
    date: '2026-08-11',
    readMinutes: 4,
    tags: ['Perfiles', 'Superficie'],
    socialHook: 'Mismo A→B, distinta bici = distinta ruta',
    socialCaption:
      'En PedalMap el perfil (carretera / gravel / MTB / urbana / e-bike) manda en el cálculo. Elige mal y “la ruta corta” te mete por pista… o por nacional.\n\npedalmap.es\n\n#gravel #mtb #ciclismo',
    body: [
      'PedalMap no trata igual una salida de carretera que una de MTB. El motor prioriza vías coherentes con el perfil: asfalto y ciclables en carretera/urbana; caminos mixtos en gravel; vías más permisivas para MTB.',
      'Si vas en bici de carretera con cubiertas finas, no elijas MTB “por probar”: puedes acabar en terreno que no quieres. Si haces gravel, el perfil gravel suele encajar mejor que forzar carretera evitando todo lo no asfaltado.',
      'Tras calcular, mira el % de idoneidad y la mezcla de superficies. Es la señal de si el perfil era el adecuado.',
    ],
    relatedPaths: [
      { to: '/planificador-rutas-bici', label: 'Planificador' },
      { to: '/rutas-mtb-madrid', label: 'MTB Madrid' },
      { to: '/rutas-gravel-madrid', label: 'Gravel Madrid' },
    ],
  },
  {
    slug: 'gpx-osmand-organic-maps',
    title: 'Seguir un GPX de PedalMap en OsmAnd u Organic Maps',
    description:
      'Navega tu ruta PedalMap en el móvil con apps libres: exporta GPX y ábrelo en OsmAnd u Organic Maps.',
    date: '2026-08-11',
    readMinutes: 3,
    tags: ['GPX', 'Móvil'],
    socialHook: 'Sin Edge: GPX + OsmAnd / Organic Maps',
    socialCaption:
      'No hace falta ciclocomputador. PedalMap → GPX → OsmAnd u Organic Maps y a rodar con el móvil.\n\npedalmap.es/crear-ruta-gpx\n\n#osmand #organicmaps #ciclismo',
    body: [
      'Si no usas Garmin ni Wahoo, puedes seguir la ruta en el teléfono. Exporta el GPX desde PedalMap y ábrelo con OsmAnd u Organic Maps (ambas trabajan bien offline con mapas descargados).',
      'También puedes usar la navegación de PedalMap en el móvil. El GPX sigue siendo útil como copia de seguridad o para compartir el track con quien sale con otra app.',
      'Lleva batería de sobra y descarga el mapa de la zona antes de perder cobertura.',
    ],
    relatedPaths: [
      { to: '/crear-ruta-gpx', label: 'Crear GPX' },
      { to: '/blog/exportar-gpx-garmin', label: 'GPX Garmin' },
      { to: '/route-planner', label: 'Planificador' },
    ],
  },
  {
    slug: 'calcular-desnivel-ruta-bici',
    title: 'Cómo calcular el desnivel de una ruta en bicicleta',
    description:
      'Qué significa desnivel positivo/negativo y cómo verlo en PedalMap al planificar tu salida.',
    date: '2026-08-11',
    readMinutes: 3,
    tags: ['Desnivel', 'Datos'],
    socialHook: 'Los km mienten. El desnivel no.',
    socialCaption:
      '40 km llanos ≠ 40 km con 900 m+. En PedalMap ves desnivel +/− y el perfil al calcular la ruta.\n\npedalmap.es\n\n#ciclismo #desnivel #entreno',
    body: [
      'El desnivel positivo suma los metros que subes; el negativo, los que bajas. Dos rutas de 50 km pueden ser mundos distintos si una acumula 1.200 m y la otra 200.',
      'Al calcular en PedalMap, el motor devuelve elevación y mostramos desnivel y un gráfico sincronizado con el mapa: pasas el dedo/ratón y ves dónde están las rampas.',
      'Úsalo para ajustar expectativas de la grupeta, elegir marchas o cambiar a un Objetivo con menos metros si vas justo de forma.',
    ],
    relatedPaths: [
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta' },
      { to: '/blog/viento-en-la-ruta', label: 'Viento en la ruta' },
      { to: '/blog/ruta-circular-objetivo', label: 'Objetivo' },
    ],
  },
  {
    slug: 'primera-ruta-pedalmap',
    title: 'Tu primera ruta en PedalMap (en 5 minutos)',
    description:
      'Guía rápida: abrir el planificador, elegir bici, calcular, guardar o exportar GPX. Sin cuenta para probar.',
    date: '2026-08-11',
    readMinutes: 3,
    tags: ['Inicio', 'Tutorial'],
    socialHook: 'Primera ruta PedalMap en 5 minutos',
    socialCaption:
      '1) pedalmap.es → Crear ruta 2) Origen + destino 3) Tipo de bici 4) Calcular 5) Mira desnivel/viento/suelo. Opcional: GPX o cuenta Free.\n\n#pedalmap #ciclismo #tutorial',
    body: [
      'Entra en pedalmap.es y pulsa crear ruta / planificador. No hace falta registrarse para el primer cálculo.',
      'Busca dónde empiezas y dónde quieres llegar (o prueba Objetivo). Elige el tipo de bici. Pulsa crear/calcular y revisa distancia, tiempo estimado, desnivel y superficie.',
      'Si te encaja: guarda con cuenta Free o exporta GPX. Si quieres más contexto local, abre las guías de Madrid, Barcelona, Valencia u otras ciudades.',
    ],
    relatedPaths: [
      { to: '/route-planner', label: 'Abrir planificador' },
      { to: '/blog/free-vs-premium', label: 'Free vs Premium' },
      { to: '/rutas-bicicleta-barcelona', label: 'Barcelona' },
    ],
  },
]

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug)
}
