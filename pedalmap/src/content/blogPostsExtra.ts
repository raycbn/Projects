import type { BlogPost } from './blogTypes'

/**
 * SEO growth batch — staggered dates look natural; all are live after deploy.
 * Import into blogPosts.ts (do not duplicate slugs).
 */
export const blogPostsExtra: BlogPost[] = [
  {
    slug: 'pedalmap-vs-strava',
    title: 'PedalMap vs Strava: planificar la ruta o registrar la actividad',
    description:
      'Diferencias claras: PedalMap planifica (desnivel, viento, GPX); Strava registra y socializa. Cómo usarlos juntos en España.',
    date: '2026-08-12',
    readMinutes: 6,
    tags: ['Comparativa', 'Strava', 'Planificar'],
    socialHook: 'Strava no planifica tu salida. PedalMap sí.',
    socialCaption:
      'Strava = actividad. PedalMap = plan antes de rodar.\npedalmap.es/blog/pedalmap-vs-strava\n#strava #ciclismo #pedalmap',
    lead:
      '**Strava** brilla al guardar y compartir lo que ya rodaste. **PedalMap** brilla **antes**: desnivel, superficie, viento y GPX. No compiten; se complementan.',
    primaryCta: { to: '/route-planner', label: 'Planificar en PedalMap' },
    secondaryCtas: [
      { to: '/que-es-pedalmap', label: 'Qué es PedalMap' },
      { to: '/crear-ruta-gpx', label: 'Exportar GPX' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Qué hace cada uno',
      },
      {
        type: 'p',
        text: 'Strava: actividades, segmentos, clubes, kudos. PedalMap: [crear ruta bicicleta](/crear-ruta-bicicleta), perfiles de bici, [desnivel](/blog/calcular-desnivel-ruta-bici), [viento relativo](/blog/viento-en-la-ruta) y [GPX](/crear-ruta-gpx).',
      },
      {
        type: 'h2',
        text: 'Flujo recomendado',
      },
      {
        type: 'p',
        text: '1) Calcula en el [planificador](/route-planner). 2) Exporta GPX si usas Edge/Wahoo. 3) Rueda. 4) Sube la actividad a Strava. Misma salida, dos herramientas.',
      },
      {
        type: 'h2',
        text: '¿Cuándo solo PedalMap?',
      },
      {
        type: 'p',
        text: 'Cuando el problema es “¿por dónde voy y con cuántos metros?” — no “¿quién hizo el KOM?”. Empieza Free en [pedalmap.es](/).',
      },
    ],
    relatedPaths: [
      { to: '/alternativa-komoot', label: 'vs Komoot' },
      { to: '/alternativa-strava-planificar', label: 'Planificar sin Strava' },
      { to: '/que-es-pedalmap', label: 'Qué es PedalMap' },
    ],
  },
  {
    slug: 'pedalmap-vs-ride-with-gps',
    title: 'PedalMap vs Ride with GPS: qué elegir en España',
    description:
      'Comparativa para ciclistas en España: PedalMap (ES, viento, perfiles) frente a Ride with GPS. Cuándo usar cada uno.',
    date: '2026-08-13',
    readMinutes: 6,
    tags: ['Comparativa', 'Ride with GPS'],
    socialHook: '¿Ride with GPS o PedalMap en España?',
    socialCaption:
      'Si planificas en español con viento y perfiles de bici: PedalMap.\npedalmap.es/blog/pedalmap-vs-ride-with-gps\n#ciclismo #pedalmap',
    lead:
      'Ride with GPS es un clásico anglosajón de planificación. Si tu día a día es **España + español + viento/superficie**, PedalMap está pensado para ese contexto.',
    primaryCta: { to: '/mejor-planificador-rutas-bici', label: 'Planificador en España' },
    secondaryCtas: [
      { to: '/route-planner', label: 'Probar PedalMap' },
      { to: '/alternativa-komoot', label: 'También vs Komoot' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Puntos fuertes de cada uno',
      },
      {
        type: 'p',
        text: 'Ride with GPS: ecosistema maduro, muchos tracks compartidos globales. PedalMap: flujo en español, [perfiles gravel/MTB](/blog/elegir-perfil-bici), viento relativo y freemium claro en [pedalmap.es](/).',
      },
      {
        type: 'h2',
        text: 'GPX en ambos',
      },
      {
        type: 'p',
        text: 'Los dos exportan. En PedalMap: [crear ruta GPX](/crear-ruta-gpx) → Garmin/Wahoo. Guía: [exportar a Garmin](/blog/exportar-gpx-garmin).',
      },
    ],
    relatedPaths: [
      { to: '/crear-ruta-gpx', label: 'GPX' },
      { to: '/blog/pedalmap-vs-strava', label: 'vs Strava' },
      { to: '/que-es-pedalmap', label: 'Qué es' },
    ],
  },
  {
    slug: 'entrenar-calor-verano-bici',
    title: 'Entrenar en bici con calor en España: planifica hora, desnivel y agua',
    description:
      'Consejos para salidas estivales: horarios, desnivel, viento y cómo preparar la ruta en PedalMap antes de salir con calor.',
    date: '2026-08-14',
    readMinutes: 5,
    tags: ['Verano', 'Entrenamiento', 'Seguridad'],
    socialHook: 'Con 35 ºC el desnivel miente el doble',
    socialCaption:
      'Calor + metros = otra salida. Planifica antes.\npedalmap.es/blog/entrenar-calor-verano-bici\n#verano #ciclismo #pedalmap',
    lead:
      'En agosto el **desnivel** y la **hora** mandan más que los kilómetros. Así preparas la ruta para no reventar a las 12:00.',
    primaryCta: { to: '/route-planner', label: 'Calcular ruta más suave' },
    secondaryCtas: [
      { to: '/blog/calcular-desnivel-ruta-bici', label: 'Entender el desnivel' },
      { to: '/ruta-circular-bicicleta', label: 'Circular / Objetivo' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Baja metros o acorta',
      },
      {
        type: 'p',
        text: 'Antes de salir, mira el perfil en el [planificador](/route-planner). Si hay 1200 m+ y va a hacer 36 ºC, cambia waypoints o usa [Objetivo](/ruta-circular-bicicleta) más corto.',
      },
      {
        type: 'h2',
        text: 'Viento y sentido',
      },
      {
        type: 'p',
        text: 'Aire de cara en falso llano con calor es doble castigo — [viento en la ruta](/blog/viento-en-la-ruta).',
      },
      {
        type: 'h2',
        text: 'Zonas típicas',
      },
      {
        type: 'p',
        text: 'Sevilla, Córdoba, Murcia, Madrid interior: sal temprano. Guías: [Sevilla](/rutas-bicicleta-sevilla), [Córdoba](/rutas-bicicleta-cordoba), [Madrid](/rutas-bicicleta-madrid).',
      },
    ],
    relatedPaths: [
      { to: '/rutas-bicicleta-sevilla', label: 'Sevilla' },
      { to: '/blog/viento-en-la-ruta', label: 'Viento' },
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta' },
    ],
  },
  {
    slug: 'ruta-bici-casa-de-campo-madrid',
    title: 'Ruta en bici por Casa de Campo (Madrid): cómo planificarla',
    description:
      'Cómo trazar una salida por Casa de Campo y Madrid Río con PedalMap: perfil urbana/carretera, desnivel y GPX.',
    date: '2026-08-15',
    readMinutes: 5,
    tags: ['Madrid', 'Urbana', 'Ejemplo'],
    socialHook: 'Casa de Campo sin improvisar el recorrido',
    socialCaption:
      'Madrid urbano con plan: Casa de Campo + desnivel visto.\npedalmap.es/blog/ruta-bici-casa-de-campo-madrid\n#madrid #ciclismo #pedalmap',
    lead:
      'Casa de Campo es el rodaje urbano por excelencia en Madrid. Así la [planificas](/rutas-bicicleta-madrid) con suelo y metros claros.',
    primaryCta: { to: '/rutas-bicicleta-madrid', label: 'Guía rutas Madrid' },
    secondaryCtas: [
      { to: '/route-planner', label: 'Abrir planificador' },
      { to: '/blog/ruta-ejemplo-madrid', label: 'Más ejemplos Madrid' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Perfil recomendado',
      },
      {
        type: 'p',
        text: 'Urbana o carretera. Evita MTB si solo quieres asfalto/carril — [elegir perfil](/blog/elegir-perfil-bici).',
      },
      {
        type: 'h2',
        text: 'Pasos',
      },
      {
        type: 'p',
        text: 'Origen cerca de Príncipe Pío / Lago → destino dentro del parque o Madrid Río → calcula → revisa desnivel (suele ser suave) → [GPX](/crear-ruta-gpx) si vas con grupeta.',
      },
    ],
    relatedPaths: [
      { to: '/rutas-bicicleta-madrid', label: 'Hub Madrid' },
      { to: '/rutas-gravel-madrid', label: 'Gravel Madrid' },
      { to: '/blog/compartir-ruta-grupeta', label: 'Grupeta' },
    ],
  },
  {
    slug: 'ruta-bici-collserola-barcelona',
    title: 'Subir a Collserola en bici: planifica desnivel y perfil',
    description:
      'Collserola desde Barcelona: carretera, gravel o MTB. Cómo ver el desnivel real y exportar GPX con PedalMap.',
    date: '2026-08-16',
    readMinutes: 5,
    tags: ['Barcelona', 'Collserola', 'Desnivel'],
    socialHook: 'Collserola: los metros se ven antes de sudarlos',
    socialCaption:
      'Barcelona → Collserola con perfil y GPX.\npedalmap.es/blog/ruta-bici-collserola-barcelona\n#barcelona #ciclismo #pedalmap',
    lead:
      'Collserola cambia la salida: de paseo costero a metros serios. Planifica el **desnivel** antes de salir del Eixample.',
    primaryCta: { to: '/rutas-bicicleta-barcelona', label: 'Guía Barcelona' },
    secondaryCtas: [
      { to: '/rutas-mtb-barcelona', label: 'MTB Barcelona' },
      { to: '/blog/calcular-desnivel-ruta-bici', label: 'Desnivel' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Elige modalidad',
      },
      {
        type: 'p',
        text: 'Carretera a miradores, [gravel](/rutas-gravel-barcelona) en pistas, [MTB](/rutas-mtb-barcelona) en más técnico. Respeta normas del parque.',
      },
      {
        type: 'h2',
        text: 'Calcula en PedalMap',
      },
      {
        type: 'p',
        text: '[Planificador](/route-planner) → origen ciudad / destino Collserola → revisa elevación → GPX al Edge si hace falta.',
      },
    ],
    relatedPaths: [
      { to: '/blog/ruta-ejemplo-barcelona', label: 'Ejemplo Barcelona' },
      { to: '/rutas-gravel-barcelona', label: 'Gravel BCN' },
      { to: '/crear-ruta-gpx', label: 'GPX' },
    ],
  },
  {
    slug: 'puerto-navacerrada-bici',
    title: 'Subir el Puerto de Navacerrada en bici: desnivel y cómo prepararlo',
    description:
      'Cómo planificar la subida a Navacerrada: kilómetros, desnivel y track GPX con PedalMap antes del puerto.',
    date: '2026-08-17',
    readMinutes: 5,
    tags: ['Madrid', 'Puerto', 'Carretera'],
    socialHook: 'Navacerrada sin sorpresas en el perfil',
    socialCaption:
      'Puerto = metros. Míralos antes en PedalMap.\npedalmap.es/blog/puerto-navacerrada-bici\n#navacerrada #ciclismo #pedalmap',
    lead:
      'Navacerrada es clásica de carretera en la sierra madrileña. El error es salir solo con “km totales” y no con el **perfil**.',
    primaryCta: { to: '/route-planner', label: 'Ver desnivel del puerto' },
    secondaryCtas: [
      { to: '/rutas-bicicleta-madrid', label: 'Rutas Madrid' },
      { to: '/rutas-mtb-madrid', label: 'MTB sierra' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Perfil carretera',
      },
      {
        type: 'p',
        text: 'Usa perfil carretera en el [planificador](/route-planner). Revisa desnivel positivo acumulado — [guía desnivel](/blog/calcular-desnivel-ruta-bici).',
      },
      {
        type: 'h2',
        text: 'Lleva el track',
      },
      {
        type: 'p',
        text: '[Exporta GPX](/crear-ruta-gpx) a Garmin/Wahoo. En grupeta: [compartir ruta](/blog/compartir-ruta-grupeta).',
      },
    ],
    relatedPaths: [
      { to: '/rutas-bicicleta-madrid', label: 'Madrid' },
      { to: '/blog/ruta-ejemplo-madrid', label: 'Ejemplo Madrid' },
      { to: '/blog/exportar-gpx-garmin', label: 'Garmin' },
    ],
  },
  {
    slug: 'gravel-sierra-guadarrama',
    title: 'Gravel en la Sierra de Guadarrama: cómo planificar pistas y desnivel',
    description:
      'Guía gravel Guadarrama: perfil gravel, superficie, viento y GPX con PedalMap para pistas y caminos.',
    date: '2026-08-18',
    readMinutes: 6,
    tags: ['Gravel', 'Madrid', 'Sierra'],
    socialHook: 'Guadarrama gravel: firme y metros antes de salir',
    socialCaption:
      'Pistas del Guadarrama con perfil gravel.\npedalmap.es/blog/gravel-sierra-guadarrama\n#gravel #madrid #pedalmap',
    lead:
      'La sierra ofrece gravel de verdad: pistas, enlaces y desnivel. El perfil **gravel** evita que el motor te mande a nacional o a full enduro.',
    primaryCta: { to: '/planificador-rutas-gravel', label: 'Planificador gravel' },
    secondaryCtas: [
      { to: '/rutas-gravel-madrid', label: 'Gravel Madrid' },
      { to: '/blog/planificar-ruta-gravel-espana', label: 'Guía gravel ES' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Perfil y superficie',
      },
      {
        type: 'p',
        text: 'Elige gravel, calcula, mira composición de suelo. Si sale demasiado técnico, cambia a carretera o acorta — [elegir perfil](/blog/elegir-perfil-bici).',
      },
      {
        type: 'h2',
        text: 'Restricciones',
      },
      {
        type: 'p',
        text: 'Espacios protegidos y vedados existen: el track no sustituye carteles ni normativa.',
      },
    ],
    relatedPaths: [
      { to: '/rutas-mtb-madrid', label: 'MTB Madrid' },
      { to: '/crear-ruta-gpx', label: 'GPX' },
      { to: '/blog/viento-en-la-ruta', label: 'Viento' },
    ],
  },
  {
    slug: 'gpx-que-es-y-para-que-sirve',
    title: 'Qué es un archivo GPX y para qué sirve en ciclismo',
    description:
      'Explicación simple del formato GPX: qué contiene, cómo usarlo en Garmin/Wahoo/móvil y cómo crearlo en PedalMap.',
    date: '2026-08-19',
    readMinutes: 5,
    tags: ['GPX', 'Tutorial', 'Inicio'],
    socialHook: 'GPX = la ruta en un archivo. Punto.',
    socialCaption:
      'Qué es un GPX y cómo crear el tuyo.\npedalmap.es/blog/gpx-que-es-y-para-que-sirve\n#gpx #ciclismo #pedalmap',
    lead:
      'Un **GPX** es un archivo con el track de tu ruta. Lo entienden Garmin, Wahoo, OsmAnd y casi cualquier GPS ciclista.',
    primaryCta: { to: '/crear-ruta-gpx', label: 'Crear mi GPX' },
    secondaryCtas: [
      { to: '/blog/exportar-gpx-garmin', label: 'Llevarlo a Garmin' },
      { to: '/blog/pasar-ruta-wahoo', label: 'Llevarlo a Wahoo' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Qué lleva dentro',
      },
      {
        type: 'p',
        text: 'Puntos lat/lon (y a veces elevación/tiempo). Es el “mapa de la ruta” en archivo.',
      },
      {
        type: 'h2',
        text: 'Cómo crear uno en PedalMap',
      },
      {
        type: 'p',
        text: 'Calcula en el [planificador](/route-planner) → exporta desde [crear ruta GPX](/crear-ruta-gpx). Free: 1/semana.',
      },
    ],
    relatedPaths: [
      { to: '/crear-ruta-gpx', label: 'Crear GPX' },
      { to: '/blog/gpx-osmand-organic-maps', label: 'GPX en el móvil' },
      { to: '/blog/primera-ruta-pedalmap', label: 'Primera ruta' },
    ],
  },
  {
    slug: 'waypoints-ruta-bici',
    title: 'Cómo usar waypoints al crear una ruta en bicicleta',
    description:
      'Añade puntos intermedios para evitar nacionales, pasar por un pueblo o forzar un puerto. Guía práctica en PedalMap.',
    date: '2026-08-20',
    readMinutes: 5,
    tags: ['Planificar', 'Tutorial'],
    socialHook: 'Un waypoint evita la nacional fea',
    socialCaption:
      'Waypoints = controlas el track.\npedalmap.es/blog/waypoints-ruta-bici\n#ciclismo #pedalmap',
    lead:
      'Origen y destino no bastan cuando quieres **evitar una carretera** o pasar por un café. Los waypoints mandan.',
    primaryCta: { to: '/route-planner', label: 'Probar con waypoints' },
    secondaryCtas: [
      { to: '/blog/evitar-carreteras-ruta-bici', label: 'Evitar principales' },
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Cuándo añadirlos',
      },
      {
        type: 'p',
        text: 'Para forzar un paso, evitar un tramo o encadenar pueblos. Combina con preferencias de [evitar carreteras](/blog/evitar-carreteras-ruta-bici).',
      },
      {
        type: 'h2',
        text: 'Revisa tras calcular',
      },
      {
        type: 'p',
        text: 'Mira idoneidad, superficie y desnivel. Si no convence, mueve el waypoint y recalcula.',
      },
    ],
    relatedPaths: [
      { to: '/planificador-rutas-bici', label: 'Planificador' },
      { to: '/blog/elegir-perfil-bici', label: 'Perfiles' },
      { to: '/ruta-circular-bicicleta', label: 'Circular' },
    ],
  },
  {
    slug: 'ebike-planificar-ruta',
    title: 'Planificar rutas en e-bike: autonomía, desnivel y perfil',
    description:
      'Cómo crear rutas para bicicleta eléctrica: desnivel, distancia y perfil e-bike en PedalMap.',
    date: '2026-08-21',
    readMinutes: 5,
    tags: ['E-bike', 'Planificar'],
    socialHook: 'E-bike también necesita desnivel de verdad',
    socialCaption:
      'E-bike: mira metros y distancia antes.\npedalmap.es/blog/ebike-planificar-ruta\n#ebike #ciclismo #pedalmap',
    lead:
      'La asistencia no elimina el **desnivel** ni la distancia. Planificar evita quedarte sin batería lejos de casa.',
    primaryCta: { to: '/route-planner', label: 'Calcular ruta e-bike' },
    secondaryCtas: [
      { to: '/blog/calcular-desnivel-ruta-bici', label: 'Desnivel' },
      { to: '/blog/elegir-perfil-bici', label: 'Perfiles' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Usa el perfil e-bike',
      },
      {
        type: 'p',
        text: 'En el [planificador](/route-planner) selecciona e-bike. Revisa km y metros + según tu autonomía real (no la del catálogo).',
      },
      {
        type: 'h2',
        text: 'Circular corta',
      },
      {
        type: 'p',
        text: 'Si pruebas batería nueva, un [Objetivo circular](/ruta-circular-bicicleta) controlado es más seguro que un A→B largo.',
      },
    ],
    relatedPaths: [
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta' },
      { to: '/crear-ruta-gpx', label: 'GPX' },
      { to: '/que-es-pedalmap', label: 'Qué es PedalMap' },
    ],
  },
  {
    slug: 'importar-gpx-revisar-desnivel',
    title: 'Importar un GPX y revisar el desnivel antes de salir',
    description:
      'Cómo usar un track GPX ajeno: impórtalo, mira elevación y decide si la salida es realista. Flujo en PedalMap.',
    date: '2026-08-22',
    readMinutes: 5,
    tags: ['GPX', 'Desnivel', 'Seguridad'],
    socialHook: 'Te pasan un GPX: ¿has mirado los metros?',
    socialCaption:
      'Importa el GPX y mira el desnivel antes.\npedalmap.es/blog/importar-gpx-revisar-desnivel\n#gpx #ciclismo #pedalmap',
    lead:
      'Un GPX de un amigo puede ser un muro. **Impórtalo**, mira el perfil y decide con datos.',
    primaryCta: { to: '/crear-ruta-gpx', label: 'Ir a GPX / importar' },
    secondaryCtas: [
      { to: '/blog/calcular-desnivel-ruta-bici', label: 'Desnivel' },
      { to: '/route-planner', label: 'Crear ruta propia' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Por qué revisar',
      },
      {
        type: 'p',
        text: 'El mismo “60 km” puede ser 400 m+ o 1400 m+. Sin perfil, firmas un cheque en blanco.',
      },
      {
        type: 'h2',
        text: 'Alternativa: créala tú',
      },
      {
        type: 'p',
        text: 'Si el track no encaja, [crea la ruta](/crear-ruta-bicicleta) con tu nivel y exporta tu propio GPX.',
      },
    ],
    relatedPaths: [
      { to: '/blog/compartir-ruta-grupeta', label: 'Grupeta' },
      { to: '/blog/exportar-gpx-garmin', label: 'Garmin' },
      { to: '/premium', label: 'Premium' },
    ],
  },
  {
    slug: 'viento-zaragoza-bici',
    title: 'Ciclismo en Zaragoza y el viento: planifica el sentido de la ruta',
    description:
      'El cierzo cambia la salida. Cómo usar el viento relativo a la ruta en PedalMap para rodajes en Zaragoza.',
    date: '2026-08-23',
    readMinutes: 5,
    tags: ['Zaragoza', 'Viento', 'Local'],
    socialHook: 'En Zaragoza el viento es el puerto',
    socialCaption:
      'Cierzo + ruta: mira el sentido antes.\npedalmap.es/blog/viento-zaragoza-bici\n#zaragoza #ciclismo #pedalmap',
    lead:
      'En el valle del Ebro el **viento** manda. Planificar el sentido de la ruta no es opcional.',
    primaryCta: { to: '/rutas-bicicleta-zaragoza', label: 'Rutas Zaragoza' },
    secondaryCtas: [
      { to: '/blog/viento-en-la-ruta', label: 'Guía viento' },
      { to: '/route-planner', label: 'Calcular ruta' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Viento relativo',
      },
      {
        type: 'p',
        text: 'No basta el parte de la ciudad: importa el ángulo respecto a tu track — [viento en la ruta](/blog/viento-en-la-ruta).',
      },
      {
        type: 'h2',
        text: 'Canal y Ebro',
      },
      {
        type: 'p',
        text: 'Rodajes largos y planos: ideal para ver el efecto del aire. Guía local: [Zaragoza](/rutas-bicicleta-zaragoza).',
      },
    ],
    relatedPaths: [
      { to: '/rutas-bicicleta-valladolid', label: 'Valladolid' },
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta' },
      { to: '/blog/entrenar-calor-verano-bici', label: 'Calor verano' },
    ],
  },
  {
    slug: 'mallorca-entreno-bici-palma',
    title: 'Entrenar en Mallorca desde Palma: cómo planificar km y puertos',
    description:
      'Stage en Mallorca: costa vs puertos. Planifica desnivel y GPX desde Palma con PedalMap.',
    date: '2026-08-24',
    readMinutes: 5,
    tags: ['Mallorca', 'Palma', 'Entrenamiento'],
    socialHook: 'Mallorca: decide costa o puerto antes del hotel',
    socialCaption:
      'Palma + puertos con desnivel visto.\npedalmap.es/blog/mallorca-entreno-bici-palma\n#mallorca #ciclismo #pedalmap',
    lead:
      'Mallorca perdona poco si improvisas el puerto. Desde Palma, define **km y desnivel** el día anterior.',
    primaryCta: { to: '/rutas-bicicleta-palma', label: 'Rutas Palma / Mallorca' },
    secondaryCtas: [
      { to: '/ruta-circular-bicicleta', label: 'Objetivo circular' },
      { to: '/crear-ruta-gpx', label: 'GPX al Edge' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Costa vs interior',
      },
      {
        type: 'p',
        text: 'Llano playero ≠ metros de verdad. Calcula en el [planificador](/route-planner) y mira el perfil.',
      },
      {
        type: 'h2',
        text: 'Lleva GPX',
      },
      {
        type: 'p',
        text: 'En stage week el Edge manda: [exportar GPX Garmin](/blog/exportar-gpx-garmin).',
      },
    ],
    relatedPaths: [
      { to: '/rutas-bicicleta-palma', label: 'Hub Palma' },
      { to: '/blog/calcular-desnivel-ruta-bici', label: 'Desnivel' },
      { to: '/premium', label: 'Premium' },
    ],
  },
  {
    slug: 'carril-bici-ruta-urbana',
    title: 'Priorizar carril bici al crear una ruta urbana',
    description:
      'Cómo orientar el planificador hacia carriles y vías tranquilas en ciudad con PedalMap.',
    date: '2026-08-25',
    readMinutes: 4,
    tags: ['Urbana', 'Seguridad', 'Planificar'],
    socialHook: 'Ruta urbana ≠ la más corta en nacional',
    socialCaption:
      'Carril primero. Recalcula si hace falta.\npedalmap.es/blog/carril-bici-ruta-urbana\n#urbana #ciclismo #pedalmap',
    lead:
      'En ciudad la ruta más corta suele ser la peor. Prioriza **carril** y vías calmadas.',
    primaryCta: { to: '/route-planner', label: 'Crear ruta urbana' },
    secondaryCtas: [
      { to: '/blog/evitar-carreteras-ruta-bici', label: 'Evitar principales' },
      { to: '/blog/elegir-perfil-bici', label: 'Perfil urbana' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Perfil urbana',
      },
      {
        type: 'p',
        text: 'Selecciona urbana, activa preferencias de carril / evitar principales, calcula y revisa el track — [evitar carreteras](/blog/evitar-carreteras-ruta-bici).',
      },
      {
        type: 'h2',
        text: 'Waypoints',
      },
      {
        type: 'p',
        text: 'Si el motor se empeña en un eje feo, fuerza un paso por un carril conocido — [waypoints](/blog/waypoints-ruta-bici).',
      },
    ],
    relatedPaths: [
      { to: '/rutas-bicicleta-madrid', label: 'Madrid' },
      { to: '/rutas-bicicleta-valencia', label: 'Valencia' },
      { to: '/rutas-bicicleta-sevilla', label: 'Sevilla' },
    ],
  },
  {
    slug: 'avisos-viento-rutas-guardadas',
    title: 'Avisos de viento en rutas guardadas: para qué sirven',
    description:
      'Cómo los avisos de viento ayudan a decidir si sales o cambias el sentido de una ruta guardada en PedalMap.',
    date: '2026-08-26',
    readMinutes: 4,
    tags: ['Viento', 'Premium', 'Producto'],
    socialHook: 'La ruta guardada también sufre el viento del finde',
    socialCaption:
      'Viento en rutas guardadas: decide antes.\npedalmap.es/blog/avisos-viento-rutas-guardadas\n#viento #pedalmap',
    lead:
      'Guardar la ruta no basta: el **viento del domingo** puede invalidar el plan del jueves.',
    primaryCta: { to: '/blog/viento-en-la-ruta', label: 'Entender el viento en ruta' },
    secondaryCtas: [
      { to: '/premium', label: 'Ver Premium' },
      { to: '/route-planner', label: 'Planificar' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Por qué importa',
      },
      {
        type: 'p',
        text: 'Misma geometría, distinto día = distinta dureza. Revisa el viento relativo antes de salir — [guía](/blog/viento-en-la-ruta).',
      },
      {
        type: 'h2',
        text: 'Free vs Premium',
      },
      {
        type: 'p',
        text: 'Límites y avisos: [Free vs Premium](/blog/free-vs-premium).',
      },
    ],
    relatedPaths: [
      { to: '/premium', label: 'Premium' },
      { to: '/blog/viento-zaragoza-bici', label: 'Caso Zaragoza' },
      { to: '/que-es-pedalmap', label: 'Qué es' },
    ],
  },
  {
    slug: 'como-guardar-ruta-bici',
    title: 'Cómo guardar una ruta de bicicleta y reutilizarla',
    description:
      'Guarda salidas en PedalMap para repetir entrenos, compartirlas o exportar GPX más tarde. Límites Free.',
    date: '2026-08-27',
    readMinutes: 4,
    tags: ['Tutorial', 'Producto'],
    socialHook: 'La buena ruta se guarda. La mala se improvisa otra vez.',
    socialCaption:
      'Guarda la ruta y reutilízala.\npedalmap.es/blog/como-guardar-ruta-bici\n#ciclismo #pedalmap',
    lead:
      'Si la salida salió redonda, **guárdala**. Repetir entreno sin recalcular desde cero.',
    primaryCta: { to: '/route-planner', label: 'Crear y guardar' },
    secondaryCtas: [
      { to: '/register', label: 'Crear cuenta Free' },
      { to: '/blog/free-vs-premium', label: 'Límites Free' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Necesitas cuenta',
      },
      {
        type: 'p',
        text: 'Puedes calcular sin registro; para guardar, crea usuario Free. Cupos en [Free vs Premium](/blog/free-vs-premium).',
      },
      {
        type: 'h2',
        text: 'Después',
      },
      {
        type: 'p',
        text: 'Reabre, exporta [GPX](/crear-ruta-gpx) o comparte con la [grupeta](/blog/compartir-ruta-grupeta).',
      },
    ],
    relatedPaths: [
      { to: '/blog/primera-ruta-pedalmap', label: 'Primera ruta' },
      { to: '/premium', label: 'Premium' },
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta' },
    ],
  },
  {
    slug: 'alternativa-bikemap',
    title: 'Alternativa a Bikemap para planificar rutas en España',
    description:
      'Si buscas una alternativa a Bikemap centrada en planificar en España con desnivel, viento y GPX, prueba PedalMap.',
    date: '2026-08-28',
    readMinutes: 5,
    tags: ['Comparativa', 'Bikemap'],
    socialHook: '¿Alternativa a Bikemap en español?',
    socialCaption:
      'Planificar en ES con desnivel y GPX: PedalMap.\npedalmap.es/blog/alternativa-bikemap\n#bikemap #ciclismo #pedalmap',
    lead:
      'Bikemap tiene comunidad y tracks. Si lo que necesitas es **planificar tú** la salida en España con viento y perfiles, PedalMap encaja.',
    primaryCta: { to: '/que-es-pedalmap', label: 'Qué es PedalMap' },
    secondaryCtas: [
      { to: '/alternativa-komoot', label: 'También vs Komoot' },
      { to: '/route-planner', label: 'Probar free' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Enfoque distinto',
      },
      {
        type: 'p',
        text: 'PedalMap no pretende ser el mayor archivo social de tracks: prioriza el flujo de planificación — [crear ruta](/crear-ruta-bicicleta), [GPX](/crear-ruta-gpx).',
      },
      {
        type: 'h2',
        text: 'Empieza Free',
      },
      {
        type: 'p',
        text: 'Sin tarjeta. Comparativa Komoot: [alternativa a Komoot](/alternativa-komoot).',
      },
    ],
    relatedPaths: [
      { to: '/blog/alternativa-komoot-espana', label: 'vs Komoot' },
      { to: '/blog/pedalmap-vs-strava', label: 'vs Strava' },
      { to: '/mejor-planificador-rutas-bici', label: 'Planificador ES' },
    ],
  },
  {
    slug: 'preparar-marcha-cicloturista',
    title: 'Preparar una marcha cicloturista: desnivel, GPX y ritmo',
    description:
      'Checklist para marchas y gran fondos: revisar desnivel del recorrido oficial, entrenar con Objetivo y llevar GPX.',
    date: '2026-08-29',
    readMinutes: 6,
    tags: ['Cicloturismo', 'Entrenamiento', 'GPX'],
    socialHook: 'La marcha se gana el mes anterior, no al dorsal',
    socialCaption:
      'Desnivel de la marcha + entrenos Objetivo.\npedalmap.es/blog/preparar-marcha-cicloturista\n#cicloturismo #pedalmap',
    lead:
      'Antes del dorsal: conoce los **metros** del recorrido y entrena circulares parecidas.',
    primaryCta: { to: '/ruta-circular-bicicleta', label: 'Entrenar con Objetivo' },
    secondaryCtas: [
      { to: '/blog/calcular-desnivel-ruta-bici', label: 'Desnivel' },
      { to: '/crear-ruta-gpx', label: 'GPX' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Estudia el perfil',
      },
      {
        type: 'p',
        text: 'Si te pasan GPX de la organización, [impórtalo y revisa desnivel](/blog/importar-gpx-revisar-desnivel). Si no, recrea tramos clave en el [planificador](/route-planner).',
      },
      {
        type: 'h2',
        text: 'Entrena específico',
      },
      {
        type: 'p',
        text: '[Objetivo circular](/ruta-circular-bicicleta) con km y m+ similares al de la marcha.',
      },
    ],
    relatedPaths: [
      { to: '/blog/ruta-circular-objetivo', label: 'Tutorial Objetivo' },
      { to: '/blog/exportar-gpx-garmin', label: 'Garmin' },
      { to: '/premium', label: 'Premium' },
    ],
  },
  {
    slug: 'diferencia-komoot-strava-pedalmap',
    title: 'Komoot, Strava y PedalMap: qué hace cada uno (sin confusiones)',
    description:
      'Tabla clara: Komoot (tracks/comunidad), Strava (actividad social), PedalMap (planificar en España). Cuándo usar cada app.',
    date: '2026-08-30',
    readMinutes: 6,
    tags: ['Comparativa', 'Komoot', 'Strava'],
    socialHook: 'Tres apps, tres trabajos. No las mezcles.',
    socialCaption:
      'Komoot / Strava / PedalMap explicados.\npedalmap.es/blog/diferencia-komoot-strava-pedalmap\n#ciclismo #pedalmap',
    lead:
      'La confusión frena a gente nueva. Aquí va la división de tareas sin marketing vacío.',
    primaryCta: { to: '/que-es-pedalmap', label: 'Definición PedalMap' },
    secondaryCtas: [
      { to: '/alternativa-komoot', label: 'Alternativa Komoot' },
      { to: '/blog/pedalmap-vs-strava', label: 'vs Strava' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Resumen',
      },
      {
        type: 'p',
        text: 'Komoot: descubrir y seguir tracks con comunidad. Strava: registrar y socializar la actividad. PedalMap: [planificar](/planificador-rutas-bici) en español con desnivel, viento, superficie y GPX.',
      },
      {
        type: 'h2',
        text: 'Flujo combo',
      },
      {
        type: 'p',
        text: 'Planifica en PedalMap → GPX al GPS → rueda → sube a Strava. Si quieres inspiración de tracks ajenos, Komoot sigue siendo útil.',
      },
    ],
    relatedPaths: [
      { to: '/blog/alternativa-komoot-espana', label: 'Post Komoot' },
      { to: '/mejor-planificador-rutas-bici', label: 'Planificador ES' },
      { to: '/crear-ruta-gpx', label: 'GPX' },
    ],
  },
  {
    slug: 'seo-primera-ruta-finde',
    title: 'Ideas de rutas para el fin de semana (y cómo calcularlas en 10 minutos)',
    description:
      'Plantilla rápida: elige ciudad, perfil de bici, km/desnivel y calcula en PedalMap antes del sábado.',
    date: '2026-08-31',
    readMinutes: 4,
    tags: ['Tutorial', 'Fin de semana'],
    socialHook: 'El finde se planifica el jueves',
    socialCaption:
      '10 minutos el jueves = mejor sábado.\npedalmap.es/blog/seo-primera-ruta-finde\n#finde #ciclismo #pedalmap',
    lead:
      'Plantilla anti-improvisación: **jueves** calculas, **sábado** ruedas.',
    primaryCta: { to: '/route-planner', label: 'Calcular ya' },
    secondaryCtas: [
      { to: '/blog/primera-ruta-pedalmap', label: 'Tutorial 5 min' },
      { to: '/blog/compartir-ruta-grupeta', label: 'Pasarlo a la grupeta' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Checklist',
      },
      {
        type: 'p',
        text: '1) Ciudad/hub ([Madrid](/rutas-bicicleta-madrid), [Barcelona](/rutas-bicicleta-barcelona)…). 2) Perfil bici. 3) Km y m+. 4) Calcular. 5) Viento. 6) GPX o guardar.',
      },
      {
        type: 'h2',
        text: 'Si no hay destino',
      },
      {
        type: 'p',
        text: 'Usa [ruta circular / Objetivo](/ruta-circular-bicicleta).',
      },
    ],
    relatedPaths: [
      { to: '/ruta-circular-bicicleta', label: 'Circular' },
      { to: '/blog/viento-en-la-ruta', label: 'Viento' },
      { to: '/crear-ruta-gpx', label: 'GPX' },
    ],
  },
]
