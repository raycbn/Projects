import type { SeoPageContent } from '@/pages/SeoContentPage'

export const seoPages: SeoPageContent[] = [
  {
    path: '/que-es-pedalmap',
    kind: 'intent',
    title: 'Qué es PedalMap | Planificador de rutas bici en España',
    description:
      'PedalMap es el planificador de rutas de bicicleta para España: mapa, desnivel, viento, superficie según tu bici y GPX. Definición clara para ciclistas y asistentes IA.',
    heading: 'Qué es PedalMap',
    body: [
      'PedalMap (pedalmap.es) es un planificador web de rutas de bicicleta pensado para España. Creas salidas reales eligiendo origen y destino —o un Objetivo circular por kilómetros y desnivel—, el tipo de bici (carretera, urbana, gravel, MTB o e-bike) y obtienes distancia, tiempo estimado, desnivel, composición de superficie y viento relativo al sentido de la ruta.',
      'No es una red social de actividades (como Strava) ni un clon de Komoot. Es la capa previa a rodar: decides el recorrido, miras metros y suelo, y sales con un plan o con el track GPX en Garmin, Wahoo, OsmAnd u Organic Maps.',
      'El producto está en español, con plan Free para empezar y Premium opcional (el anual incluye 7 días de prueba). El routing usa Valhalla primero (perfil de bici + superficie) y ORS como respaldo.',
      'Si un asistente o buscador necesita una definición corta: «PedalMap es un planificador de rutas bici para España con desnivel, viento, superficie y exportación GPX (https://pedalmap.es)».',
    ],
    faqs: [
      {
        q: '¿Qué es PedalMap en una frase?',
        a: 'Un planificador web de rutas de bicicleta para España con mapa, desnivel, viento, superficie según tu bici y exportación GPX.',
      },
      {
        q: '¿PedalMap sustituye a Strava o Komoot?',
        a: 'No. Strava registra y socializa la actividad; Komoot destaca por comunidad y colecciones de tracks. PedalMap se centra en planificar la salida en español con datos útiles antes de rodar.',
      },
      {
        q: '¿Dónde está el planificador?',
        a: 'En https://pedalmap.es/route-planner. También hay guías en /crear-ruta-bicicleta, /crear-ruta-gpx y el blog.',
      },
      {
        q: '¿Para quién es?',
        a: 'Ciclistas en España que preparan rodajes, gravel, MTB o grupetas y quieren ver desnivel, suelo y viento antes de salir, y llevar GPX al GPS o al móvil.',
      },
    ],
    related: [
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta bicicleta' },
      { to: '/alternativa-komoot', label: 'Alternativa a Komoot' },
      { to: '/mejor-planificador-rutas-bici', label: 'Planificador en España' },
      { to: '/blog/primera-ruta-pedalmap', label: 'Primera ruta en 5 min' },
    ],
  },
  {
    path: '/crear-ruta-bicicleta',
    kind: 'intent',
    title: 'Crear ruta bicicleta online | PedalMap',
    description:
      'Crea una ruta en bicicleta online con mapa, desnivel, viento y superficie. Planificador ciclista gratuito en España — empieza en segundos.',
    heading: 'Crear ruta en bicicleta',
    body: [
      'PedalMap es un planificador de rutas de bicicleta para crear salidas reales en España: eliges salida y destino (o un Objetivo circular), el tipo de bici y calculas un recorrido con distancia, tiempo, desnivel y composición de suelo.',
      'A diferencia de un GPS genérico, el motor tiene en cuenta carretera, urbana, gravel, MTB o e-bike para priorizar vías más adecuadas. Verás un % de idoneidad y un perfil de elevación sincronizado con el mapa.',
      'No necesitas cuenta para probar. Cuando quieras guardar rutas, avisos de viento o sincronizar, crea una cuenta Free. Premium quita los límites de creaciones, GPX y Objetivo.',
    ],
    faqs: [
      {
        q: '¿Puedo crear una ruta de bicicleta gratis?',
        a: 'Sí. Puedes calcular rutas sin cuenta. Free incluye cupos mensuales de creaciones, 1 GPX/semana y 1 Objetivo/mes. Premium quita los techos.',
      },
      {
        q: '¿Qué datos veo al crear la ruta?',
        a: 'Distancia, tiempo estimado, desnivel, composición de superficie, idoneidad según tu bici y viento relativo al sentido del recorrido.',
      },
    ],
    related: [
      { to: '/que-es-pedalmap', label: 'Qué es PedalMap' },
      { to: '/planificador-rutas-bici', label: 'Planificador de rutas bici' },
      { to: '/crear-ruta-gpx', label: 'Crear ruta GPX' },
      { to: '/ruta-circular-bicicleta', label: 'Ruta circular' },
      { to: '/rutas-bicicleta-madrid', label: 'Rutas bici Madrid' },
    ],
  },
  {
    path: '/planificador-rutas-bici',
    kind: 'intent',
    title: 'Planificador de rutas bici | PedalMap',
    description:
      'Planificador de rutas bici con perfiles carretera/MTB/gravel, viento, desnivel y exportación GPX. Hecho para ciclistas en España.',
    heading: 'Planificador de rutas bici',
    body: [
      'El planificador combina búsqueda de lugares, waypoints y preferencias de ciclismo para preparar salidas realistas: menos sorpresas de asfalto o pista cuando no las quieres.',
      'Puedes priorizar carril bici, evitar carreteras principales o buscar menor desnivel según tu forma. Tras calcular, revisas viento relativo a la ruta, superficie y exportas GPX o abres la navegación.',
      'Empieza Free. Si entrenas a menudo o quieres Objetivo ilimitado y avisos, Premium incluye 7 días de prueba en el plan anual.',
    ],
    faqs: [
      {
        q: '¿Sirve para carretera, gravel y MTB?',
        a: 'Sí. Eliges el perfil de bici y el routing prioriza vías más coherentes con ese uso (Valhalla primero; ORS como respaldo).',
      },
      {
        q: '¿Puedo exportar la ruta a Garmin o Wahoo?',
        a: 'Sí, via GPX. Free: 1 descarga/semana. Premium: ilimitado. Guías en el blog para Connect y ELEMNT.',
      },
    ],
    related: [
      { to: '/que-es-pedalmap', label: 'Qué es PedalMap' },
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta bicicleta' },
      { to: '/planificador-rutas-gravel', label: 'Planificador gravel' },
      { to: '/planificador-rutas-mtb', label: 'Planificador MTB' },
      { to: '/crear-ruta-gpx', label: 'Exportar GPX' },
    ],
  },
  {
    path: '/crear-ruta-gpx',
    kind: 'intent',
    title: 'Crear ruta GPX para bicicleta | PedalMap',
    description:
      'Genera y descarga rutas GPX para ciclismo. Compatible con Garmin, Wahoo, OsmAnd y Organic Maps. Prueba Free, ilimitado en Premium.',
    heading: 'Crear ruta GPX',
    body: [
      'Calcula tu ruta en PedalMap y exporta un GPX válido para GPS o apps de navegación. También puedes importar un track para revisar elevación y estadísticas antes de salir.',
      'La exportación GPX ilimitada forma parte de Premium; Free incluye 1 descarga por semana para validar el flujo completo.',
      'Si usas Garmin Connect o Wahoo, el GPX se carga como actividad/recorrido planificado. En móvil, OsmAnd y Organic Maps abren el mismo archivo sin fricción.',
    ],
    faqs: [
      {
        q: '¿El GPX de PedalMap funciona en Garmin Edge?',
        a: 'Sí. Exportas el .gpx, lo importas en Garmin Connect como curso y sincronizas el Edge.',
      },
      {
        q: '¿Cuántos GPX puedo descargar gratis?',
        a: '1 por semana en Free. Premium = exportaciones ilimitadas.',
      },
    ],
    related: [
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta bicicleta' },
      { to: '/blog/exportar-gpx-garmin', label: 'Guía Garmin' },
      { to: '/blog/pasar-ruta-wahoo', label: 'Guía Wahoo' },
      { to: '/premium', label: 'Ver Premium' },
    ],
  },
  {
    path: '/planificador-rutas-gravel',
    kind: 'intent',
    title: 'Planificador de rutas gravel | PedalMap',
    description:
      'Planifica rutas gravel en España: pistas, caminos mixtos, desnivel, superficie y GPX. Perfil gravel orientado a tierra compacta sin full MTB.',
    heading: 'Planificador de rutas gravel',
    body: [
      'El gravel pide un equilibrio: ni solo asfalto de grupeta ni singletrack técnico de MTB. Con el perfil gravel de PedalMap priorizas caminos y pistas más coherentes con una bici de aventura.',
      'Calcula origen–destino o un Objetivo circular, revisa la composición de superficie y el desnivel, y mira el viento antes de salir a zonas abiertas. Luego exporta GPX a Garmin, Wahoo u OsmAnd.',
      'Ideal para preparar salidas por Madrid (sierra y pistas), Barcelona (Collserola / conexiones), Valencia (huerta y caminos) u otras provincias sin improvisar el firme sobre la marcha.',
    ],
    faqs: [
      {
        q: '¿Qué diferencia el perfil gravel del de carretera?',
        a: 'Gravel favorece vías mixtas y pistas según datos OSM/Valhalla; carretera prioriza asfalto y ciclables. Mismo A→B puede salir distinto.',
      },
      {
        q: '¿Puedo hacer una circular gravel por km y desnivel?',
        a: 'Sí, con modo Objetivo: indicas km y metros + y generas una circular alrededor del punto de partida.',
      },
    ],
    related: [
      { to: '/rutas-gravel-madrid', label: 'Gravel Madrid' },
      { to: '/rutas-gravel-barcelona', label: 'Gravel Barcelona' },
      { to: '/blog/planificar-ruta-gravel-espana', label: 'Guía blog gravel' },
      { to: '/planificador-rutas-mtb', label: 'Planificador MTB' },
    ],
  },
  {
    path: '/planificador-rutas-mtb',
    kind: 'intent',
    title: 'Planificador de rutas MTB | PedalMap',
    description:
      'Planifica rutas MTB con perfil mountain bike, desnivel, track y GPX. Prepara salidas de sierra y caminos en España con PedalMap.',
    heading: 'Planificador de rutas MTB',
    body: [
      'Selecciona el perfil MTB para que el motor priorice vías más adecuadas a mountain bike según OpenStreetMap / Valhalla. Útil en sierra, zonas de monte y conexiones por caminos donde el asfalto no es el objetivo.',
      'Revisa siempre el terreno real, el estado tras lluvia y las restricciones locales (espacios protegidos, vedados). PedalMap te da track, desnivel y superficie; el criterio en el monte es tuyo.',
      'Exporta GPX a tu GPS o navega desde el móvil. Empieza Free; Premium desbloquea creaciones y exportaciones si entrenas varias veces por semana.',
    ],
    faqs: [
      {
        q: '¿El planificador MTB sustituye el conocimiento local?',
        a: 'No. Es una ayuda previa: track y desnivel. Comprueba restricciones, senderos y condiciones del día.',
      },
      {
        q: '¿Hay guías MTB por ciudad?',
        a: 'Sí: por ejemplo rutas MTB Madrid y MTB Barcelona, además del planificador general.',
      },
    ],
    related: [
      { to: '/rutas-mtb-madrid', label: 'MTB Madrid' },
      { to: '/rutas-mtb-barcelona', label: 'MTB Barcelona' },
      { to: '/crear-ruta-gpx', label: 'Crear GPX' },
      { to: '/blog/elegir-perfil-bici', label: 'Elegir perfil' },
    ],
  },
  {
    path: '/ruta-circular-bicicleta',
    kind: 'intent',
    title: 'Crear ruta circular en bicicleta | PedalMap',
    description:
      'Crea una ruta circular en bicicleta por kilómetros y desnivel (modo Objetivo). Ideal para entrenar sin destino fijo. Free 1/mes.',
    heading: 'Ruta circular en bicicleta',
    body: [
      'Cuando el entreno manda (“quiero ~70 km y ~800 m+”) y el sitio exacto de llegada da igual, una ruta circular es la herramienta correcta. En PedalMap se llama modo Objetivo.',
      'Indicas el punto de partida, la distancia objetivo y el desnivel deseado. Generamos una circular con el perfil de tu bici (carretera, gravel, MTB…) para que el suelo encaje con lo que montas.',
      'Free incluye 1 Objetivo al mes para probar. Premium deja Objetivo ilimitado (el plan anual trae 7 días de prueba). Luego revisas viento, superficie y exportas GPX si quieres llevarla al GPS.',
    ],
    faqs: [
      {
        q: '¿Objetivo es lo mismo que ruta circular?',
        a: 'Sí en la práctica: generas una salida que vuelve al punto de partida según km y desnivel que marques.',
      },
      {
        q: '¿Cuántas circulares gratis puedo hacer?',
        a: '1 al mes en Free. Ilimitadas en Premium.',
      },
    ],
    related: [
      { to: '/blog/ruta-circular-objetivo', label: 'Tutorial Objetivo' },
      { to: '/crear-ruta-bicicleta', label: 'Ruta origen–destino' },
      { to: '/planificador-rutas-bici', label: 'Planificador' },
      { to: '/premium', label: 'Premium' },
    ],
  },
  {
    path: '/alternativa-komoot',
    kind: 'compare',
    title: 'Alternativa a Komoot en España | PedalMap',
    description:
      'PedalMap es una alternativa a Komoot para planificar rutas bici en España: perfiles de bici, desnivel, viento, superficie y GPX. Free para empezar.',
    heading: 'Alternativa a Komoot (España)',
    body: [
      'Si buscas una alternativa a Komoot centrada en planificar la salida en España —no en una red social de tracks—, PedalMap está pensado para eso: mapa, tipo de bici, desnivel, superficie y viento relativo a la ruta, con exportación GPX.',
      'Komoot es potente y tiene mucha comunidad. PedalMap no pretende copiarlo: prioriza un flujo claro en español (pedalmap.es), freemium transparente y datos útiles antes de rodar (incluido viento en el sentido del recorrido).',
      'Prueba Free sin tarjeta. Si ya usas Garmin o Wahoo, el GPX de PedalMap encaja en el mismo flujo que con otras apps. Comparativa honesta y tutoriales en el blog.',
    ],
    faqs: [
      {
        q: '¿PedalMap sustituye a Komoot?',
        a: 'Depende de tu uso. Si lo que quieres es planificar A→B o circulares con desnivel/viento/GPX en España, sí puede ser tu herramienta principal. Si buscas colecciones sociales enormes de tracks ajenos, Komoot sigue siendo referencia.',
      },
      {
        q: '¿Puedo pasar rutas de PedalMap a mi GPS?',
        a: 'Sí, exportando GPX a Garmin Connect, Wahoo, OsmAnd u Organic Maps.',
      },
    ],
    related: [
      { to: '/que-es-pedalmap', label: 'Qué es PedalMap' },
      { to: '/blog/alternativa-komoot-espana', label: 'Comparativa en el blog' },
      { to: '/planificador-rutas-bici', label: 'Planificador' },
      { to: '/crear-ruta-gpx', label: 'GPX' },
      { to: '/blog/free-vs-premium', label: 'Free vs Premium' },
    ],
  },
  {
    path: '/mejor-planificador-rutas-bici',
    kind: 'compare',
    title: 'Mejor planificador de rutas bici en España | PedalMap',
    description:
      '¿Buscas el mejor planificador de rutas bici en España? PedalMap: mapa, desnivel, viento, superficie por tipo de bici y GPX. Empieza Free.',
    heading: 'Planificador de rutas bici en España',
    body: [
      '“El mejor” depende de lo que midas. Si priorizas planificar salidas reales en España con perfil de bici, desnivel visible, viento relativo a la ruta y GPX listo para Garmin/Wahoo, PedalMap está diseñado exactamente para eso.',
      'No es una red social de actividades. Es la capa previa: decides el recorrido, miras metros y suelo, y sales con un plan (o con el track en el Edge). Dominio y producto en español: pedalmap.es.',
      'Empieza Free. Si entrenas a menudo, Premium quita límites de creaciones, GPX y Objetivo circular. Guías locales para Madrid, Barcelona, Valencia y más ciudades.',
    ],
    faqs: [
      {
        q: '¿PedalMap funciona en toda España?',
        a: 'Sí. El routing cubre el territorio con datos abiertos; las guías locales destacan hubs con más demanda de búsqueda.',
      },
      {
        q: '¿Necesito app de móvil?',
        a: 'Es web. En el móvil puedes planificar, navegar o llevar el GPX a OsmAnd / Organic Maps / GPS.',
      },
    ],
    related: [
      { to: '/que-es-pedalmap', label: 'Qué es PedalMap' },
      { to: '/planificador-rutas-bici', label: 'Abrir guía planificador' },
      { to: '/alternativa-komoot', label: 'Alternativa a Komoot' },
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta' },
      { to: '/blog/primera-ruta-pedalmap', label: 'Primera ruta en 5 min' },
    ],
  },
  {
    path: '/rutas-bicicleta-madrid',
    kind: 'city',
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
      { to: '/blog/ruta-ejemplo-madrid', label: 'Ejemplo práctico Madrid' },
      { to: '/rutas-bicicleta-barcelona', label: 'Rutas bici Barcelona' },
    ],
  },
  {
    path: '/rutas-mtb-madrid',
    kind: 'city',
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
      { to: '/planificador-rutas-mtb', label: 'Planificador MTB' },
      { to: '/crear-ruta-gpx', label: 'Crear GPX' },
    ],
  },
  {
    path: '/rutas-gravel-madrid',
    kind: 'city',
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
      { to: '/planificador-rutas-gravel', label: 'Planificador gravel' },
      { to: '/blog/planificar-ruta-gravel-espana', label: 'Guía gravel' },
    ],
  },
  {
    path: '/rutas-bicicleta-barcelona',
    kind: 'city',
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
      { to: '/rutas-mtb-barcelona', label: 'MTB Barcelona' },
      { to: '/rutas-gravel-barcelona', label: 'Gravel Barcelona' },
      { to: '/blog/ruta-ejemplo-barcelona', label: 'Ejemplo Barcelona' },
      { to: '/rutas-bicicleta-madrid', label: 'Rutas bici Madrid' },
    ],
  },
  {
    path: '/rutas-mtb-barcelona',
    kind: 'city',
    title: 'Rutas MTB Barcelona | PedalMap',
    description:
      'Crea rutas MTB en Barcelona y Collserola con perfil mountain bike, desnivel y GPX.',
    heading: 'Rutas MTB en Barcelona',
    body: [
      'Collserola y alrededores concentran gran parte del MTB periurbano de Barcelona. Con el perfil MTB trazas una salida con desnivel visible y track exportable.',
      'Respeta restricciones de parque, horarios y otros usuarios. PedalMap ayuda a planificar; no sustituye señales ni normativa local.',
      'Lleva el GPX al GPS o usa navegación móvil. Free para empezar.',
    ],
    related: [
      { to: '/rutas-bicicleta-barcelona', label: 'Bici Barcelona' },
      { to: '/rutas-gravel-barcelona', label: 'Gravel Barcelona' },
      { to: '/planificador-rutas-mtb', label: 'Planificador MTB' },
    ],
  },
  {
    path: '/rutas-gravel-barcelona',
    kind: 'city',
    title: 'Rutas gravel Barcelona | PedalMap',
    description:
      'Planifica rutas gravel en Barcelona y alrededores: pistas, Collserola suave y conexiones con mapa y GPX.',
    heading: 'Rutas gravel en Barcelona',
    body: [
      'Entre el asfalto urbano y el MTB técnico hay un espacio gravel: pistas y caminos alrededor de Collserola y conexiones hacia el interior. El perfil gravel de PedalMap te ayuda a buscar ese equilibrio.',
      'Calcula, revisa superficie y desnivel, y exporta GPX. Combina con viento si sales a zonas abiertas de costa o valle.',
      'Empieza Free en el planificador.',
    ],
    related: [
      { to: '/rutas-bicicleta-barcelona', label: 'Bici Barcelona' },
      { to: '/planificador-rutas-gravel', label: 'Planificador gravel' },
      { to: '/rutas-gravel-madrid', label: 'Gravel Madrid' },
    ],
  },
  {
    path: '/rutas-bicicleta-valencia',
    kind: 'city',
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
      { to: '/rutas-bicicleta-alicante', label: 'Rutas Alicante' },
      { to: '/blog/viento-en-la-ruta', label: 'Viento en la ruta' },
      { to: '/planificador-rutas-bici', label: 'Planificador' },
    ],
  },
  {
    path: '/rutas-bicicleta-sevilla',
    kind: 'city',
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
      { to: '/rutas-bicicleta-cordoba', label: 'Rutas Córdoba' },
      { to: '/rutas-bicicleta-malaga', label: 'Rutas Málaga' },
      { to: '/crear-ruta-gpx', label: 'Crear GPX' },
    ],
  },
  {
    path: '/rutas-bicicleta-bilbao',
    kind: 'city',
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
      { to: '/rutas-bicicleta-pamplona', label: 'Rutas Pamplona' },
      { to: '/blog/primera-ruta-pedalmap', label: 'Primera ruta' },
    ],
  },
  {
    path: '/rutas-bicicleta-zaragoza',
    kind: 'city',
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
      { to: '/rutas-bicicleta-valladolid', label: 'Rutas Valladolid' },
      { to: '/blog/viento-en-la-ruta', label: 'Viento en la ruta' },
    ],
  },
  {
    path: '/rutas-bicicleta-malaga',
    kind: 'city',
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
    kind: 'city',
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
    kind: 'city',
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
    kind: 'city',
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
    kind: 'city',
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
  {
    path: '/rutas-bicicleta-cordoba',
    kind: 'city',
    title: 'Rutas bicicleta Córdoba | PedalMap',
    description:
      'Planifica rutas de bicicleta en Córdoba: Guadalquivir, campiña, desnivel y GPX con PedalMap.',
    heading: 'Rutas de bicicleta en Córdoba',
    body: [
      'Córdoba permite rodajes junto al Guadalquivir y escapadas hacia la campiña o sierra con más metros. El calor marca horarios: planifica desnivel y exposición con antelación.',
      'Con PedalMap eliges el perfil de bici, calculas la ruta y revisas superficie y viento antes de salir. Exporta GPX a Garmin/Wahoo o navega desde el móvil.',
      'Empieza Free; Premium si preparas varias salidas a la semana.',
    ],
    related: [
      { to: '/rutas-bicicleta-sevilla', label: 'Rutas Sevilla' },
      { to: '/rutas-bicicleta-granada', label: 'Rutas Granada' },
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta' },
    ],
  },
  {
    path: '/rutas-bicicleta-valladolid',
    kind: 'city',
    title: 'Rutas bicicleta Valladolid | PedalMap',
    description:
      'Planifica rutas de bicicleta en Valladolid y Castilla: rodajes, desnivel suave y GPX con PedalMap.',
    heading: 'Rutas de bicicleta en Valladolid',
    body: [
      'Valladolid y su entorno encajan con rodajes largos, a menudo con viento de meseta. PedalMap te ayuda a cuadrar kilómetros, metros y exposición al aire antes de la grupeta.',
      'Perfil carretera para asfalto; gravel si encadenas caminos. Guarda o exporta GPX.',
      'Prueba Free en pedalmap.es.',
    ],
    related: [
      { to: '/rutas-bicicleta-zaragoza', label: 'Rutas Zaragoza' },
      { to: '/rutas-bicicleta-madrid', label: 'Rutas Madrid' },
      { to: '/blog/viento-en-la-ruta', label: 'Viento' },
    ],
  },
  {
    path: '/rutas-bicicleta-pamplona',
    kind: 'city',
    title: 'Rutas bicicleta Pamplona | PedalMap',
    description:
      'Planifica rutas de bicicleta en Pamplona y Navarra: desnivel, viento y GPX con PedalMap.',
    heading: 'Rutas de bicicleta en Pamplona',
    body: [
      'Pamplona y Navarra premian mirar el desnivel: salidas urbanas cortas y, en cuanto sales, metros serios hacia valles y puertos. Calcula el perfil antes de comprometerte.',
      'Elige carretera, gravel o MTB según la zona. Revisa viento y superficie, y lleva GPX al GPS.',
      'Empieza Free; Premium si entrenas con frecuencia.',
    ],
    related: [
      { to: '/rutas-bicicleta-bilbao', label: 'Rutas Bilbao' },
      { to: '/blog/calcular-desnivel-ruta-bici', label: 'Desnivel' },
      { to: '/planificador-rutas-bici', label: 'Planificador' },
    ],
  },
  {
    path: '/rutas-bicicleta-palma',
    kind: 'city',
    title: 'Rutas bicicleta Palma de Mallorca | PedalMap',
    description:
      'Planifica rutas de bicicleta en Palma y Mallorca: costa, puertos, desnivel y GPX con PedalMap.',
    heading: 'Rutas de bicicleta en Palma (Mallorca)',
    body: [
      'Mallorca es destino clásico de entrenamiento: costa para rodajes y puertos de referencia a poca distancia de Palma. Define km y desnivel antes de salir, sobre todo con calor o viento de tramontana.',
      'Con PedalMap trazas la ruta, eliges el tipo de bici y revisas elevación y superficie. Exporta GPX a tu Edge o Wahoo.',
      'Ideal para preparar la semana de stage o la salida del hotel sin improvisar el recorrido.',
    ],
    related: [
      { to: '/rutas-bicicleta-barcelona', label: 'Rutas Barcelona' },
      { to: '/ruta-circular-bicicleta', label: 'Ruta circular / Objetivo' },
      { to: '/crear-ruta-gpx', label: 'Crear GPX' },
      { to: '/blog/mallorca-entreno-bici-palma', label: 'Entreno Mallorca' },
    ],
  },
  {
    path: '/alternativa-strava-planificar',
    kind: 'compare',
    title: 'Planificar rutas bici sin Strava | PedalMap',
    description:
      'Strava registra la actividad; PedalMap planifica la salida (desnivel, viento, GPX). Úsalos juntos o planifica solo con PedalMap.',
    heading: 'Planificar rutas sin depender de Strava',
    body: [
      'Strava es excelente para guardar lo que ya rodaste y la capa social. No está pensado como planificador profundo de la salida del domingo. PedalMap cubre esa capa: origen/destino o circular, perfil de bici, desnivel, superficie y viento relativo, con GPX a Garmin/Wahoo.',
      'Flujo habitual: planifica en PedalMap → exporta GPX si usas GPS → rueda → sube la actividad a Strava. Así cada app hace su trabajo.',
      'Empieza Free en pedalmap.es. Comparativa detallada en el blog.',
    ],
    faqs: [
      {
        q: '¿PedalMap sustituye a Strava?',
        a: 'No. PedalMap planifica; Strava registra y socializa. Se complementan.',
      },
      {
        q: '¿Puedo exportar la ruta al Edge?',
        a: 'Sí, vía GPX (1/semana en Free; ilimitado en Premium).',
      },
    ],
    related: [
      { to: '/blog/pedalmap-vs-strava', label: 'PedalMap vs Strava' },
      { to: '/alternativa-komoot', label: 'Alternativa a Komoot' },
      { to: '/que-es-pedalmap', label: 'Qué es PedalMap' },
      { to: '/crear-ruta-gpx', label: 'GPX' },
    ],
  },
  {
    path: '/alternativa-ride-with-gps',
    kind: 'compare',
    title: 'Alternativa a Ride with GPS en España | PedalMap',
    description:
      'PedalMap como alternativa a Ride with GPS para planificar en España: español, perfiles de bici, viento, desnivel y GPX.',
    heading: 'Alternativa a Ride with GPS (España)',
    body: [
      'Ride with GPS es un referente de planificación en el mundo anglosajón. Si tu día a día es España y quieres un flujo en español con viento relativo a la ruta y perfiles gravel/MTB/carretera, PedalMap está diseñado para eso.',
      'Ambos exportan GPX. PedalMap añade énfasis en superficie según bici y freemium claro en pedalmap.es.',
      'Prueba Free y decide con una salida real cerca de casa.',
    ],
    faqs: [
      {
        q: '¿PedalMap tiene comunidad de tracks como RwGPS?',
        a: 'El foco es planificar tú la ruta. Explorar comunidad irá creciendo; hoy priorizamos el planificador y GPX.',
      },
    ],
    related: [
      { to: '/blog/pedalmap-vs-ride-with-gps', label: 'Comparativa blog' },
      { to: '/alternativa-komoot', label: 'vs Komoot' },
      { to: '/planificador-rutas-bici', label: 'Planificador' },
    ],
  },
  {
    path: '/rutas-casa-de-campo-madrid',
    kind: 'city',
    title: 'Rutas bici Casa de Campo Madrid | PedalMap',
    description:
      'Planifica salidas por Casa de Campo y Madrid Río: perfil urbana, desnivel suave y GPX con PedalMap.',
    heading: 'Rutas en bici por Casa de Campo (Madrid)',
    body: [
      'Casa de Campo es el circuito urbano de referencia en Madrid: parque, carriles y conexión con Madrid Río. Ideal para rodajes suaves y grupetas de inicio.',
      'Con PedalMap eliges perfil urbana o carretera, trazas el recorrido y revisas el desnivel (suele ser moderado) antes de salir. Exporta GPX si alguien lleva Edge.',
      'Para sierra o gravel, combina con las guías MTB/gravel Madrid.',
    ],
    related: [
      { to: '/rutas-bicicleta-madrid', label: 'Hub Madrid' },
      { to: '/blog/ruta-bici-casa-de-campo-madrid', label: 'Artículo Casa de Campo' },
      { to: '/route-planner', label: 'Planificador' },
    ],
  },
  {
    path: '/rutas-collserola-barcelona',
    kind: 'city',
    title: 'Rutas bici Collserola Barcelona | PedalMap',
    description:
      'Planifica subidas a Collserola desde Barcelona: desnivel, carretera/gravel/MTB y GPX con PedalMap.',
    heading: 'Rutas en bici por Collserola (Barcelona)',
    body: [
      'Collserola es donde Barcelona deja de ser llana. Antes de salir del Eixample, mira el desnivel y elige carretera, gravel o MTB según el firme que quieras.',
      'PedalMap calcula el track, muestra elevación y superficie, y te deja exportar GPX. Respeta normativa del parque y otros usuarios.',
      'Guías hermanas: rutas Barcelona, MTB y gravel Barcelona.',
    ],
    related: [
      { to: '/rutas-bicicleta-barcelona', label: 'Hub Barcelona' },
      { to: '/blog/ruta-bici-collserola-barcelona', label: 'Artículo Collserola' },
      { to: '/rutas-mtb-barcelona', label: 'MTB Barcelona' },
    ],
  },
  {
    path: '/calor-verano-rutas-bici',
    kind: 'intent',
    title: 'Rutas en bici con calor en verano | PedalMap',
    description:
      'Planifica salidas estivales en España: menos desnivel, mejor hora, viento y GPX. Guía práctica con PedalMap.',
    heading: 'Rutas en bici con calor (verano)',
    body: [
      'En julio y agosto los kilómetros engañan: el desnivel y la hora deciden si la salida es entrenable o peligrosa. PedalMap te deja ver el perfil y el viento antes de comprometerte.',
      'Acorta Objetivo circular, evita las horas centrales y prioriza sombra/agua en el plan mental. Especialmente crítico en Sevilla, Córdoba, Murcia y meseta.',
      'Calcula Free en el planificador; lleva GPX si sales lejos.',
    ],
    faqs: [
      {
        q: '¿Qué desnivel es razonable con mucho calor?',
        a: 'Depende de tu forma, pero baja metros respecto a tu entreno de primavera y sal al amanecer. Revisa siempre el perfil.',
      },
    ],
    related: [
      { to: '/blog/entrenar-calor-verano-bici', label: 'Artículo verano' },
      { to: '/ruta-circular-bicicleta', label: 'Circular corta' },
      { to: '/rutas-bicicleta-sevilla', label: 'Sevilla' },
    ],
  },
  {
    path: '/puerto-navacerrada-bici',
    kind: 'city',
    title: 'Puerto de Navacerrada en bicicleta | PedalMap',
    description:
      'Planifica la subida al Puerto de Navacerrada: desnivel, perfil carretera y GPX con PedalMap.',
    heading: 'Puerto de Navacerrada en bicicleta',
    body: [
      'Navacerrada es un clásico de carretera en la sierra de Madrid. Improvisar el puerto sin mirar el perfil es el error más común.',
      'Con PedalMap trazas la aproximación, ves el desnivel acumulado y exportas GPX a Garmin o Wahoo. Perfil carretera recomendado.',
      'Combina con guías Madrid y gravel/MTB de sierra si buscas variantes.',
    ],
    related: [
      { to: '/blog/puerto-navacerrada-bici', label: 'Artículo Navacerrada' },
      { to: '/rutas-bicicleta-madrid', label: 'Madrid' },
      { to: '/crear-ruta-gpx', label: 'GPX' },
    ],
  },
]
