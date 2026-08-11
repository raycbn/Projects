export type BlogBlock = { type: 'h2'; text: string } | { type: 'p'; text: string }

export interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  readMinutes: number
  tags: string[]
  socialHook: string
  socialCaption: string
  /** Intro under the H1 */
  lead: string
  blocks: BlogBlock[]
  /** Main button → product surface that does the thing */
  primaryCta: { to: string; label: string }
  secondaryCtas?: Array<{ to: string; label: string }>
  relatedPaths?: Array<{ to: string; label: string }>
}

/**
 * Inline links use markdown: [texto](/ruta-interna)
 * Keep paths absolute-from-root so they deep-link into the app.
 */
export const blogPosts: BlogPost[] = [
  {
    slug: 'exportar-gpx-garmin',
    title: 'Cómo exportar una ruta GPX a Garmin desde PedalMap',
    description:
      'Guía para crear una ruta ciclista, descargar el GPX en PedalMap e importarlo en Garmin Connect o tu Edge. Incluye límites Free y Premium.',
    date: '2026-08-11',
    readMinutes: 6,
    tags: ['GPX', 'Garmin', 'Exportar ruta'],
    socialHook: 'GPX de PedalMap → Garmin en 60 segundos',
    socialCaption:
      '¿Ruta lista y el Edge vacío? PedalMap → exportar GPX → Garmin Connect.\npedalmap.es/crear-ruta-gpx\n#ciclismo #garmin #gpx #pedalmap',
    lead:
      'Si quieres **crear una ruta GPX** y llevarla a tu Garmin, PedalMap cubre el flujo completo: planificar con desnivel y superficie, exportar el archivo e importarlo en Connect.',
    primaryCta: { to: '/crear-ruta-gpx', label: 'Crear / exportar ruta GPX' },
    secondaryCtas: [
      { to: '/route-planner', label: 'Abrir planificador' },
      { to: '/premium', label: 'GPX ilimitado (Premium)' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Qué necesitas',
      },
      {
        type: 'p',
        text: 'Una cuenta Free o Premium en PedalMap (puedes [calcular la ruta sin registrarte](/route-planner) y exportar cuando tengas cupo GPX), Garmin Connect (app o web) y tu Edge u otro GPS compatible con GPX.',
      },
      {
        type: 'h2',
        text: 'Paso 1 — Crear la ruta en el planificador',
      },
      {
        type: 'p',
        text: 'Entra en el [planificador de rutas bici](/route-planner), busca origen y destino (o waypoints), elige el tipo de bici (carretera, gravel, MTB, urbana o e-bike) y pulsa crear ruta. Revisa distancia, **desnivel positivo**, superficie y viento antes de exportar: así evitas un track que luego no quieres en el Edge.',
      },
      {
        type: 'p',
        text: 'Si buscas solo el flujo GPX, la guía [crear ruta GPX](/crear-ruta-gpx) resume el producto; el trabajo real se hace en el planificador.',
      },
      {
        type: 'h2',
        text: 'Paso 2 — Exportar el archivo GPX',
      },
      {
        type: 'p',
        text: 'Con la ruta calculada, usa la exportación GPX desde la pantalla de ruta lista. En el plan **Free** tienes 1 exportación por semana; en [PedalMap Premium](/premium) las exportaciones son ilimitadas (ideal si preparas varias salidas o cambias el track a menudo).',
      },
      {
        type: 'h2',
        text: 'Paso 3 — Importar en Garmin Connect',
      },
      {
        type: 'p',
        text: 'En Garmin Connect (web suele ser más cómodo): Guarda / Cursos → Importar → selecciona el `.gpx`. Abre el curso en el mapa, comprueba que el track cuadra, y sincroniza el Edge. En la app móvil el menú puede decir “Cursos” o “Rutas” según versión.',
      },
      {
        type: 'h2',
        text: 'Consejos SEO-prácticos (para que la ruta salga bien)',
      },
      {
        type: 'p',
        text: 'No exportes a ciegas: si el % de idoneidad o la mezcla de asfalto/pista no te convence, vuelve al [planificador](/route-planner), cambia preferencias o perfil de bici y genera otra variante. Para salidas por Madrid, parte de la guía [rutas bicicleta Madrid](/rutas-bicicleta-madrid).',
      },
      {
        type: 'p',
        text: '¿Usas Wahoo en vez de Garmin? Misma exportación GPX, distinto destino: [cómo pasar la ruta a Wahoo](/blog/pasar-ruta-wahoo).',
      },
    ],
    relatedPaths: [
      { to: '/crear-ruta-gpx', label: 'Página crear ruta GPX' },
      { to: '/blog/pasar-ruta-wahoo', label: 'GPX a Wahoo' },
      { to: '/blog/gpx-osmand-organic-maps', label: 'GPX en el móvil' },
    ],
  },
  {
    slug: 'pasar-ruta-wahoo',
    title: 'Cómo pasar una ruta de PedalMap a Wahoo (ELEMNT)',
    description:
      'Exporta un GPX desde el planificador PedalMap e impórtalo en la app Wahoo / ELEMNT para seguir el track en carretera o gravel.',
    date: '2026-08-11',
    readMinutes: 5,
    tags: ['GPX', 'Wahoo', 'ELEMNT'],
    socialHook: 'De PedalMap a Wahoo sin líos',
    socialCaption:
      'PedalMap → GPX → app Wahoo. Suelo, viento y desnivel antes de salir.\npedalmap.es/crear-ruta-gpx\n#wahoo #gpx #ciclismo',
    lead:
      'Wahoo ELEMNT entiende rutas en GPX. La forma limpia de trabajar: **planificar la ruta en PedalMap**, exportar y cargar el archivo en el ecosistema Wahoo.',
    primaryCta: { to: '/crear-ruta-gpx', label: 'Ir a crear ruta GPX' },
    secondaryCtas: [
      { to: '/route-planner', label: 'Planificar ahora' },
      { to: '/premium', label: 'Exportaciones ilimitadas' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Planifica con el perfil de bici correcto',
      },
      {
        type: 'p',
        text: 'Abre el [planificador de rutas en bicicleta](/route-planner) y elige carretera, gravel o MTB según lo que montes. El routing no es genérico: la superficie influye en el track que luego verás en el ELEMNT. Más detalle en [elegir perfil de bici](/blog/elegir-perfil-bici).',
      },
      {
        type: 'h2',
        text: 'Revisa viento y desnivel antes del GPX',
      },
      {
        type: 'p',
        text: 'Antes de exportar, mira el **desnivel** y el viento relativo a la ruta. Una misma distancia cambia mucho con aire de cara. Guía rápida: [viento en la ruta](/blog/viento-en-la-ruta) y [calcular desnivel](/blog/calcular-desnivel-ruta-bici).',
      },
      {
        type: 'h2',
        text: 'Exportar GPX e importar en Wahoo',
      },
      {
        type: 'p',
        text: 'Desde la ruta lista, exporta GPX ([flujo explicado aquí](/crear-ruta-gpx)). En la app Wahoo / ELEMNT, importa el archivo como ruta o recorrido y sincroniza el dispositivo. Confirma en el mapa del ciclocomputador que el track completo está cargado.',
      },
      {
        type: 'p',
        text: 'Free: 1 GPX/semana. Si iteras entrenos a diario, [Premium](/premium) quita el techo. ¿Garmin? → [exportar GPX a Garmin](/blog/exportar-gpx-garmin).',
      },
    ],
    relatedPaths: [
      { to: '/crear-ruta-gpx', label: 'Crear ruta GPX' },
      { to: '/blog/exportar-gpx-garmin', label: 'Garmin' },
      { to: '/premium', label: 'Premium' },
    ],
  },
  {
    slug: 'ruta-circular-objetivo',
    title: 'Cómo crear una ruta circular (modo Objetivo) en PedalMap',
    description:
      'Genera rutas circulares por kilómetros y desnivel con Objetivo: ideal para entrenos sin destino fijo. 1 prueba Free al mes, ilimitado en Premium.',
    date: '2026-08-11',
    readMinutes: 6,
    tags: ['Objetivo', 'Ruta circular', 'Entreno'],
    socialHook: '¿X km y Y de desnivel? Objetivo lo traza',
    socialCaption:
      'Circular a medida: km + desnivel + tipo de bici. Modo Objetivo en PedalMap.\npedalmap.es/route-planner\n#ciclismo #entreno',
    lead:
      'El **modo Objetivo** de PedalMap crea una **ruta circular** a partir de un punto, una distancia y un desnivel objetivo. No necesitas inventarte el destino a mano.',
    primaryCta: { to: '/route-planner', label: 'Abrir planificador (Objetivo)' },
    secondaryCtas: [
      { to: '/premium', label: 'Objetivo ilimitado' },
      { to: '/blog/calcular-desnivel-ruta-bici', label: 'Entender el desnivel' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Cuándo usar Objetivo (y no A→B)',
      },
      {
        type: 'p',
        text: 'Usa Objetivo cuando el entreno manda (“quiero ~70 km y ~900 m+”) y el sitio exacto de llegada da igual. Para ir de un pueblo a otro, mejor [crear ruta bicicleta](/crear-ruta-bicicleta) clásica origen–destino en el [planificador](/route-planner).',
      },
      {
        type: 'h2',
        text: 'Cómo se configura',
      },
      {
        type: 'p',
        text: 'En el planificador, activa Objetivo, marca el punto de partida, indica kilómetros y desnivel, elige el tipo de bici y calcula. El motor prioriza perfiles coherentes (Valhalla primero) para no devolverte una “circular” por nacional o por un sendero imposible en carretera.',
      },
      {
        type: 'h2',
        text: 'Free vs Premium',
      },
      {
        type: 'p',
        text: 'Free incluye **1 Objetivo al mes** para probar. Si preparas varios entrenos semanales, [PedalMap Premium](/premium) deja Objetivo ilimitado (el plan anual trae 7 días de prueba). Comparativa: [Free vs Premium](/blog/free-vs-premium).',
      },
      {
        type: 'h2',
        text: 'Después de calcular',
      },
      {
        type: 'p',
        text: 'Revisa el perfil de elevación, la superficie y el viento. Si encaja, guarda la ruta o [exporta GPX](/crear-ruta-gpx) a Garmin, Wahoo u OsmAnd. Primera vez en la app: [tu primera ruta en 5 minutos](/blog/primera-ruta-pedalmap).',
      },
    ],
    relatedPaths: [
      { to: '/route-planner', label: 'Planificador' },
      { to: '/premium', label: 'Premium' },
      { to: '/blog/free-vs-premium', label: 'Free vs Premium' },
    ],
  },
  {
    slug: 'viento-en-la-ruta',
    title: 'Viento en la ruta: cómo planificar salidas en bici sin llevártelo de cara',
    description:
      'Por qué el viento importa al crear una ruta ciclista y cómo usar la información de viento de PedalMap antes de salir.',
    date: '2026-08-11',
    readMinutes: 5,
    tags: ['Viento', 'Planificar ruta', 'Entrenamiento'],
    socialHook: 'El viento no se ve en Strava hasta que duele',
    socialCaption:
      'Misma ruta, distinto día. Mira el viento relativo al track en PedalMap.\npedalmap.es/route-planner\n#ciclismo #viento',
    lead:
      'Al **planificar una ruta en bicicleta**, el viento puede convertir un llano “fácil” en un entreno duro. PedalMap muestra el viento en el contexto del recorrido, no solo un icono suelto del tiempo.',
    primaryCta: { to: '/route-planner', label: 'Planificar ruta con viento' },
    secondaryCtas: [
      { to: '/planificador-rutas-bici', label: 'Qué hace el planificador' },
      { to: '/premium', label: 'Avisos de viento (Premium)' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Por qué mirarlo antes de salir',
      },
      {
        type: 'p',
        text: 'El viento de cara en falso llano cansa más que un puerto corto. Si das la vuelta al circuito, el tramo “de vuelta” puede ser el que te rompa. Por eso conviene ver el viento **respecto al sentido** de la ruta al [crear la ruta](/crear-ruta-bicicleta).',
      },
      {
        type: 'h2',
        text: 'Cómo usarlo en PedalMap',
      },
      {
        type: 'p',
        text: 'Calcula en el [planificador](/route-planner), revisa elevación y viento, y decide: invertir dirección, acortar el tramo expuesto o cambiar de día. Combínalo con el [desnivel real](/blog/calcular-desnivel-ruta-bici).',
      },
      {
        type: 'h2',
        text: 'Zonas donde el viento pesa más',
      },
      {
        type: 'p',
        text: 'Valles abiertos y costa: mira guías como [rutas bicicleta Zaragoza](/rutas-bicicleta-zaragoza), [Alicante](/rutas-bicicleta-alicante) o [Santander](/rutas-bicicleta-santander). En días feos, un Objetivo más corto desde el [planificador](/route-planner) puede salvar la salida.',
      },
      {
        type: 'p',
        text: 'Si guardas rutas favoritas, [Premium](/premium) encaja con avisos cuando una salida pinta especialmente bien de viento.',
      },
    ],
    relatedPaths: [
      { to: '/route-planner', label: 'Planificador' },
      { to: '/blog/calcular-desnivel-ruta-bici', label: 'Desnivel' },
      { to: '/premium', label: 'Premium' },
    ],
  },
  {
    slug: 'free-vs-premium',
    title: 'PedalMap Free vs Premium: límites, precios y cuándo merece la pena',
    description:
      'Comparativa clara del plan Free y Premium: rutas, GPX, Objetivo, trial de 7 días en el anual y enlaces para suscribirte o seguir gratis.',
    date: '2026-08-11',
    readMinutes: 5,
    tags: ['Premium', 'Free', 'Precios'],
    socialHook: 'Free para probar. Premium cuando entrenas en serio.',
    socialCaption:
      'Free: rutas reales + 1 GPX/semana + 1 Objetivo/mes. Premium sin techos (trial 7 días en el anual).\npedalmap.es/premium\n#pedalmap',
    lead:
      'Puedes **crear rutas de bicicleta gratis** en PedalMap. Premium quita techos cuando ya usas GPX, Objetivo o muchas creaciones al mes.',
    primaryCta: { to: '/premium', label: 'Ver planes Premium' },
    secondaryCtas: [
      { to: '/route-planner', label: 'Seguir en Free (planificador)' },
      { to: '/crear-ruta-bicicleta', label: 'Cómo crear una ruta' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Qué incluye Free',
      },
      {
        type: 'p',
        text: 'Calcular rutas en el [planificador](/route-planner), ver desnivel, superficie y viento, cupo de rutas guardadas y creaciones mensuales, **1 GPX por semana** y **1 Objetivo al mes**. Empieza por [tu primera ruta](/blog/primera-ruta-pedalmap).',
      },
      {
        type: 'h2',
        text: 'Qué desbloquea Premium',
      },
      {
        type: 'p',
        text: 'Creaciones, GPX y Objetivo sin los techos Free, pensado para quien entrena varias veces por semana o prepara grupetas. Detalle y checkout en [PedalMap Premium](/premium) (aprox. 4,99 €/mes o 39,99 €/año con **7 días de prueba** en el anual).',
      },
      {
        type: 'h2',
        text: 'Cuándo subir',
      },
      {
        type: 'p',
        text: 'Si te frenas por el GPX semanal o por el Objetivo mensual, Premium compensa. Si solo sales de vez en cuando, Free + [crear ruta GPX](/crear-ruta-gpx) cuando toque es suficiente.',
      },
    ],
    relatedPaths: [
      { to: '/premium', label: 'Página Premium' },
      { to: '/blog/ruta-circular-objetivo', label: 'Modo Objetivo' },
      { to: '/blog/exportar-gpx-garmin', label: 'Exportar GPX' },
    ],
  },
  {
    slug: 'ruta-ejemplo-madrid',
    title: 'Cómo planificar una ruta de bicicleta en Madrid (ejemplo práctico)',
    description:
      'Ejemplo para crear una ruta ciclista en Madrid con PedalMap: Casa de Campo, ciudad o sierra, desnivel, superficie y GPX.',
    date: '2026-08-11',
    readMinutes: 6,
    tags: ['Madrid', 'Rutas bicicleta', 'Ejemplo'],
    socialHook: 'Madrid en bici sin improvisar el desnivel',
    socialCaption:
      'Casa de Campo o sierra: traza, mira metros y GPX.\npedalmap.es/rutas-bicicleta-madrid\n#madrid #ciclismo',
    lead:
      'Madrid cambia en 20 km: llano urbano, Casa de Campo o sierra. Esta guía te lleva del [hub de rutas Madrid](/rutas-bicicleta-madrid) al [planificador](/route-planner) con un ejemplo usable.',
    primaryCta: { to: '/rutas-bicicleta-madrid', label: 'Guía rutas Madrid' },
    secondaryCtas: [
      { to: '/route-planner', label: 'Abrir planificador' },
      { to: '/rutas-gravel-madrid', label: 'Gravel Madrid' },
      { to: '/rutas-mtb-madrid', label: 'MTB Madrid' },
    ],
    blocks: [
      {
        type: 'h2',
        text: '1) Elige el tipo de salida',
      },
      {
        type: 'p',
        text: 'Rodaje suave (Madrid Río / Casa de Campo), desnivel (dirección sierra: Colmenar, Soto, Escorial) o mixtos gravel/MTB. Lee el contexto en [rutas bicicleta Madrid](/rutas-bicicleta-madrid), [gravel](/rutas-gravel-madrid) o [MTB](/rutas-mtb-madrid).',
      },
      {
        type: 'h2',
        text: '2) Trázala en PedalMap',
      },
      {
        type: 'p',
        text: 'Abre el [planificador](/route-planner), pon inicio y fin (o [Objetivo circular](/blog/ruta-circular-objetivo)), selecciona el perfil de bici y calcula. Revisa desnivel y superficie: es lo que diferencia improvisar de salir con plan.',
      },
      {
        type: 'h2',
        text: '3) Llévatela al GPS o al móvil',
      },
      {
        type: 'p',
        text: 'Exporta desde [crear ruta GPX](/crear-ruta-gpx) a Garmin, Wahoo u OsmAnd. Tutoriales: [Garmin](/blog/exportar-gpx-garmin), [Wahoo](/blog/pasar-ruta-wahoo), [OsmAnd / Organic Maps](/blog/gpx-osmand-organic-maps).',
      },
    ],
    relatedPaths: [
      { to: '/rutas-bicicleta-madrid', label: 'Madrid' },
      { to: '/route-planner', label: 'Planificador' },
      { to: '/rutas-bicicleta-barcelona', label: 'Barcelona' },
    ],
  },
  {
    slug: 'elegir-perfil-bici',
    title: 'Carretera, gravel o MTB: qué perfil elegir al crear una ruta',
    description:
      'El tipo de bici cambia el routing en PedalMap. Aprende cuándo usar cada perfil para crear rutas ciclistas con la superficie adecuada.',
    date: '2026-08-11',
    readMinutes: 6,
    tags: ['Perfil bici', 'Gravel', 'MTB', 'Carretera'],
    socialHook: 'Mismo A→B, distinta bici = distinta ruta',
    socialCaption:
      'Carretera ≠ gravel ≠ MTB en PedalMap. Elige perfil antes de calcular.\npedalmap.es/route-planner\n#gravel #mtb',
    lead:
      'Al **crear una ruta en bicicleta**, el perfil (carretera, urbana, gravel, MTB, e-bike) no es cosmética: cambia vías prioritarias y la mezcla de superficie del track.',
    primaryCta: { to: '/route-planner', label: 'Probar perfiles en el planificador' },
    secondaryCtas: [
      { to: '/planificador-rutas-bici', label: 'Sobre el planificador' },
      { to: '/rutas-gravel-madrid', label: 'Ejemplo gravel Madrid' },
      { to: '/rutas-mtb-madrid', label: 'Ejemplo MTB Madrid' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Carretera y urbana',
      },
      {
        type: 'p',
        text: 'Priorizan asfalto y ciclables. Úsalas para rodajes y grupetas de carretera. Empieza en [crear ruta bicicleta](/crear-ruta-bicicleta) o directo en el [planificador](/route-planner).',
      },
      {
        type: 'h2',
        text: 'Gravel',
      },
      {
        type: 'p',
        text: 'Encaja con caminos mixtos y pistas. Si fuerzas “carretera” en zona de pistas, el track puede alargar por asfalto; con gravel suele acercarse más a lo que quieres. Ejemplo local: [rutas gravel Madrid](/rutas-gravel-madrid).',
      },
      {
        type: 'h2',
        text: 'MTB',
      },
      {
        type: 'p',
        text: 'Más permisivo con vías off-road. Revisa siempre terreno y restricciones. Guía: [rutas MTB Madrid](/rutas-mtb-madrid).',
      },
      {
        type: 'h2',
        text: 'Cómo validar la elección',
      },
      {
        type: 'p',
        text: 'Tras calcular, mira el % de idoneidad y la composición de suelo. Si no cuadra, cambia perfil y vuelve a generar. Luego [exporta GPX](/crear-ruta-gpx) cuando el track sea el bueno.',
      },
    ],
    relatedPaths: [
      { to: '/route-planner', label: 'Planificador' },
      { to: '/rutas-gravel-madrid', label: 'Gravel Madrid' },
      { to: '/rutas-mtb-madrid', label: 'MTB Madrid' },
    ],
  },
  {
    slug: 'gpx-osmand-organic-maps',
    title: 'Seguir un GPX de PedalMap en OsmAnd u Organic Maps',
    description:
      'Navega tu ruta ciclista en el móvil: exporta GPX desde PedalMap y ábrelo en OsmAnd u Organic Maps, o usa la navegación de la app.',
    date: '2026-08-11',
    readMinutes: 5,
    tags: ['GPX', 'OsmAnd', 'Organic Maps', 'Navegación'],
    socialHook: 'Sin Edge: GPX + OsmAnd / Organic Maps',
    socialCaption:
      'PedalMap → GPX → OsmAnd u Organic Maps.\npedalmap.es/crear-ruta-gpx\n#osmand #ciclismo',
    lead:
      'No hace falta ciclocomputador para seguir un track. **Crea la ruta en PedalMap**, exporta GPX y ábrelo en OsmAnd u Organic Maps — o usa la navegación integrada.',
    primaryCta: { to: '/crear-ruta-gpx', label: 'Crear y exportar GPX' },
    secondaryCtas: [
      { to: '/route-planner', label: 'Planificar la ruta' },
      { to: '/blog/exportar-gpx-garmin', label: '¿Prefieres Garmin?' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Generar el GPX',
      },
      {
        type: 'p',
        text: 'Calcula en el [planificador](/route-planner) y exporta desde el flujo [crear ruta GPX](/crear-ruta-gpx). Free: 1/semana; [Premium](/premium): ilimitado.',
      },
      {
        type: 'h2',
        text: 'Abrir en OsmAnd u Organic Maps',
      },
      {
        type: 'p',
        text: 'Importa el `.gpx` como track o guía. Descarga el mapa offline de la zona antes de perder cobertura. Lleva batería o powerbank.',
      },
      {
        type: 'h2',
        text: 'Alternativa: navegación PedalMap',
      },
      {
        type: 'p',
        text: 'También puedes seguir la salida con la navegación de PedalMap en el móvil tras calcular la ruta. El GPX sigue siendo útil para compartir el track con quien usa otra app.',
      },
    ],
    relatedPaths: [
      { to: '/crear-ruta-gpx', label: 'Crear GPX' },
      { to: '/route-planner', label: 'Planificador' },
      { to: '/blog/pasar-ruta-wahoo', label: 'Wahoo' },
    ],
  },
  {
    slug: 'calcular-desnivel-ruta-bici',
    title: 'Cómo calcular el desnivel de una ruta en bicicleta',
    description:
      'Qué es el desnivel positivo y negativo y cómo verlo al planificar rutas ciclistas en PedalMap con perfil de elevación.',
    date: '2026-08-11',
    readMinutes: 5,
    tags: ['Desnivel', 'Elevación', 'Planificar'],
    socialHook: 'Los km mienten. El desnivel no.',
    socialCaption:
      '40 km llanos ≠ 40 km con 900 m+. Ves desnivel +/− al calcular en PedalMap.\npedalmap.es/route-planner\n#desnivel #ciclismo',
    lead:
      'Al **calcular una ruta en bici**, los kilómetros solos engañan. El desnivel positivo/negativo y el perfil de elevación dicen cómo será el entreno.',
    primaryCta: { to: '/route-planner', label: 'Calcular desnivel en el planificador' },
    secondaryCtas: [
      { to: '/blog/ruta-circular-objetivo', label: 'Circular por km + desnivel' },
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta bicicleta' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Desnivel positivo vs negativo',
      },
      {
        type: 'p',
        text: 'El positivo suma lo que subes; el negativo, lo que bajas. Dos rutas de 50 km pueden ser mundos distintos (200 m+ vs 1.200 m+).',
      },
      {
        type: 'h2',
        text: 'Cómo lo muestra PedalMap',
      },
      {
        type: 'p',
        text: 'Al calcular en el [planificador de rutas bici](/route-planner), el motor devuelve elevación: ves totales y un gráfico sincronizado con el mapa. Sirve para ajustar marchas, expectativas de grupeta o pasar a [Objetivo](/blog/ruta-circular-objetivo) con menos metros.',
      },
      {
        type: 'h2',
        text: 'Combínalo con viento y superficie',
      },
      {
        type: 'p',
        text: 'Un puerto con viento de cara no se siente igual que en calma. Mira también [viento en la ruta](/blog/viento-en-la-ruta) y el [perfil de bici](/blog/elegir-perfil-bici). Zonas con mucho desnivel: [Granada](/rutas-bicicleta-granada), [Madrid sierra](/rutas-bicicleta-madrid).',
      },
    ],
    relatedPaths: [
      { to: '/route-planner', label: 'Planificador' },
      { to: '/blog/viento-en-la-ruta', label: 'Viento' },
      { to: '/blog/ruta-circular-objetivo', label: 'Objetivo' },
    ],
  },
  {
    slug: 'primera-ruta-pedalmap',
    title: 'Tu primera ruta en PedalMap: crear una ruta en bicicleta en 5 minutos',
    description:
      'Tutorial paso a paso para crear tu primera ruta ciclista en PedalMap: planificador, tipo de bici, desnivel, guardar y exportar GPX.',
    date: '2026-08-11',
    readMinutes: 5,
    tags: ['Tutorial', 'Crear ruta', 'Inicio'],
    socialHook: 'Primera ruta PedalMap en 5 minutos',
    socialCaption:
      'Origen + destino + bici + calcular. Desnivel, viento y suelo.\npedalmap.es/route-planner\n#pedalmap #tutorial',
    lead:
      'Guía rápida para **crear una ruta en bicicleta online** sin fricción: del mapa al GPX, con enlaces directos a cada pantalla.',
    primaryCta: { to: '/route-planner', label: 'Crear mi primera ruta ahora' },
    secondaryCtas: [
      { to: '/crear-ruta-bicicleta', label: 'Guía crear ruta bicicleta' },
      { to: '/blog', label: 'Más tutoriales del blog' },
    ],
    blocks: [
      {
        type: 'h2',
        text: '1) Abre el planificador',
      },
      {
        type: 'p',
        text: 'Entra en [pedalmap.es/route-planner](/route-planner). No hace falta cuenta para el primer cálculo. Contexto del producto: [crear ruta bicicleta](/crear-ruta-bicicleta) y [planificador de rutas bici](/planificador-rutas-bici).',
      },
      {
        type: 'h2',
        text: '2) Origen, destino y tipo de bici',
      },
      {
        type: 'p',
        text: 'Busca inicio y fin (o prueba [Objetivo](/blog/ruta-circular-objetivo)). Elige carretera, gravel, MTB, urbana o e-bike — [cómo elegir perfil](/blog/elegir-perfil-bici).',
      },
      {
        type: 'h2',
        text: '3) Calcula y revisa',
      },
      {
        type: 'p',
        text: 'Mira distancia, tiempo estimado, **desnivel**, superficie y viento. Si no convence, cambia preferencias y vuelve a calcular.',
      },
      {
        type: 'h2',
        text: '4) Guardar o exportar',
      },
      {
        type: 'p',
        text: 'Crea cuenta Free para guardar, o [exporta GPX](/crear-ruta-gpx). Límites y upgrade: [Free vs Premium](/blog/free-vs-premium). Ideas locales: [Madrid](/rutas-bicicleta-madrid), [Barcelona](/rutas-bicicleta-barcelona), [Valencia](/rutas-bicicleta-valencia).',
      },
    ],
    relatedPaths: [
      { to: '/route-planner', label: 'Planificador' },
      { to: '/crear-ruta-gpx', label: 'GPX' },
      { to: '/premium', label: 'Premium' },
    ],
  },
  {
    slug: 'alternativa-komoot-espana',
    title: 'Alternativa a Komoot en España: cuándo PedalMap encaja mejor',
    description:
      'Comparativa honesta: PedalMap como alternativa a Komoot para planificar rutas bici en España (desnivel, viento, GPX, freemium).',
    date: '2026-08-12',
    readMinutes: 7,
    tags: ['Comparativa', 'Komoot', 'Planificar'],
    socialHook: '¿Alternativa a Komoot en España? PedalMap para planificar de verdad',
    socialCaption:
      'No es “matar” a Komoot: es planificar en ES con desnivel, viento y GPX.\npedalmap.es/alternativa-komoot\n#ciclismo #komoot #pedalmap',
    lead:
      'Si buscas una **alternativa a Komoot** centrada en **planificar** la salida en España —mapa, tipo de bici, desnivel, viento y GPX— PedalMap está hecho para eso. Aquí va una comparativa clara, sin humo.',
    primaryCta: { to: '/alternativa-komoot', label: 'Ver página alternativa a Komoot' },
    secondaryCtas: [
      { to: '/route-planner', label: 'Probar el planificador' },
      { to: '/crear-ruta-gpx', label: 'Exportar GPX' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Qué hace bien Komoot',
      },
      {
        type: 'p',
        text: 'Komoot brilla por comunidad, colecciones de tracks y un ecosistema maduro. Mucha gente lo usa como biblioteca de rutas ajenas y como navegación. Si eso es tu flujo principal, seguirá siendo una referencia.',
      },
      {
        type: 'h2',
        text: 'Dónde PedalMap aporta',
      },
      {
        type: 'p',
        text: 'PedalMap no es red social de actividades. Es la capa **previa a rodar**: [crear ruta bicicleta](/crear-ruta-bicicleta) con perfil carretera/gravel/MTB, ver **desnivel** y **superficie**, mirar **viento relativo** al sentido, y [exportar GPX](/crear-ruta-gpx) a Garmin/Wahoo/OsmAnd. Producto y dominio en español ([pedalmap.es](/)).',
      },
      {
        type: 'h2',
        text: 'Cuándo elegir PedalMap',
      },
      {
        type: 'p',
        text: 'Cuando quieres diseñar tú la salida (A→B o [circular/Objetivo](/ruta-circular-bicicleta)), comparar variantes por suelo y metros, y llevar el track al GPS sin fricción. Empieza Free; Premium solo si ya lo usas a menudo — [Free vs Premium](/blog/free-vs-premium).',
      },
      {
        type: 'h2',
        text: 'Prueba en 5 minutos',
      },
      {
        type: 'p',
        text: 'Abre el [planificador](/route-planner), calcula una salida cerca de casa y mira elevación + viento. Tutorial: [primera ruta](/blog/primera-ruta-pedalmap). Guías locales: [Madrid](/rutas-bicicleta-madrid), [Barcelona](/rutas-bicicleta-barcelona).',
      },
    ],
    relatedPaths: [
      { to: '/alternativa-komoot', label: 'Landing vs Komoot' },
      { to: '/mejor-planificador-rutas-bici', label: 'Planificador en España' },
      { to: '/blog/free-vs-premium', label: 'Free vs Premium' },
    ],
  },
  {
    slug: 'planificar-ruta-gravel-espana',
    title: 'Cómo planificar una ruta gravel en España (perfil, superficie y GPX)',
    description:
      'Guía para crear rutas gravel: perfil de bici, superficie, desnivel, viento y exportación GPX con PedalMap.',
    date: '2026-08-12',
    readMinutes: 6,
    tags: ['Gravel', 'Planificar', 'GPX'],
    socialHook: 'Gravel sin improvisar el firme: perfil + superficie + GPX',
    socialCaption:
      'Mismo A→B, distinta bici = distinta ruta. Perfil gravel en PedalMap.\npedalmap.es/planificador-rutas-gravel\n#gravel #ciclismo #pedalmap',
    lead:
      'El gravel pide equilibrio: ni solo asfalto ni full enduro. Así planificas una **ruta gravel** en PedalMap con perfil correcto, superficie visible y GPX listo.',
    primaryCta: { to: '/planificador-rutas-gravel', label: 'Abrir planificador gravel' },
    secondaryCtas: [
      { to: '/rutas-gravel-madrid', label: 'Gravel Madrid' },
      { to: '/rutas-gravel-barcelona', label: 'Gravel Barcelona' },
    ],
    blocks: [
      {
        type: 'h2',
        text: '1) Elige el perfil gravel',
      },
      {
        type: 'p',
        text: 'En el [planificador](/route-planner) selecciona gravel. El routing prioriza vías mixtas según datos abiertos. Por qué importa: [elegir perfil de bici](/blog/elegir-perfil-bici).',
      },
      {
        type: 'h2',
        text: '2) Revisa superficie y desnivel',
      },
      {
        type: 'p',
        text: 'Antes de salir, mira la composición de suelo y el [desnivel](/blog/calcular-desnivel-ruta-bici). Si ves demasiado asfalto o un tramo demasiado técnico, cambia preferencias o waypoints y vuelve a calcular.',
      },
      {
        type: 'h2',
        text: '3) Viento y circular',
      },
      {
        type: 'p',
        text: 'En pistas abiertas el viento duele. Guía: [viento en la ruta](/blog/viento-en-la-ruta). Si no tienes destino fijo, prueba una [ruta circular](/ruta-circular-bicicleta) (Objetivo).',
      },
      {
        type: 'h2',
        text: '4) GPX al GPS',
      },
      {
        type: 'p',
        text: 'Exporta desde [crear ruta GPX](/crear-ruta-gpx). Tutoriales: [Garmin](/blog/exportar-gpx-garmin), [Wahoo](/blog/pasar-ruta-wahoo).',
      },
    ],
    relatedPaths: [
      { to: '/planificador-rutas-gravel', label: 'Planificador gravel' },
      { to: '/blog/elegir-perfil-bici', label: 'Perfiles de bici' },
      { to: '/rutas-gravel-madrid', label: 'Gravel Madrid' },
    ],
  },
  {
    slug: 'ruta-ejemplo-barcelona',
    title: 'Cómo planificar una ruta de bicicleta en Barcelona (ejemplo práctico)',
    description:
      'Ejemplo para trazar rutas bici en Barcelona: costa, Collserola, desnivel, perfil de bici y GPX con PedalMap.',
    date: '2026-08-12',
    readMinutes: 5,
    tags: ['Barcelona', 'Ejemplo', 'Crear ruta'],
    socialHook: 'Barcelona: costa o Collserola — planifica desnivel antes',
    socialCaption:
      'Misma ciudad, salidas muy distintas. Traza en PedalMap y mira metros.\npedalmap.es/rutas-bicicleta-barcelona\n#barcelona #ciclismo #pedalmap',
    lead:
      'Barcelona mezcla paseo marítimo y metros serios en Collserola. Este ejemplo te guía para **planificar la ruta** sin improvisar el desnivel.',
    primaryCta: { to: '/rutas-bicicleta-barcelona', label: 'Guía rutas Barcelona' },
    secondaryCtas: [
      { to: '/route-planner', label: 'Abrir planificador' },
      { to: '/rutas-mtb-barcelona', label: 'MTB Barcelona' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Define el tipo de salida',
      },
      {
        type: 'p',
        text: '¿Rodaje costero plano o subida a Collserola? Elige el [perfil de bici](/blog/elegir-perfil-bici) (carretera, gravel o MTB) antes de calcular. Guías: [MTB Barcelona](/rutas-mtb-barcelona), [gravel Barcelona](/rutas-gravel-barcelona).',
      },
      {
        type: 'h2',
        text: 'Traza en el planificador',
      },
      {
        type: 'p',
        text: 'Abre el [planificador](/route-planner), pon origen y destino (o [Objetivo circular](/ruta-circular-bicicleta)), calcula y revisa desnivel + superficie + viento.',
      },
      {
        type: 'h2',
        text: 'Exporta o navega',
      },
      {
        type: 'p',
        text: 'GPX a Garmin/Wahoo o móvil: [crear ruta GPX](/crear-ruta-gpx). Primera vez: [tutorial 5 minutos](/blog/primera-ruta-pedalmap).',
      },
    ],
    relatedPaths: [
      { to: '/rutas-bicicleta-barcelona', label: 'Hub Barcelona' },
      { to: '/blog/ruta-ejemplo-madrid', label: 'Ejemplo Madrid' },
      { to: '/crear-ruta-gpx', label: 'GPX' },
    ],
  },
  {
    slug: 'evitar-carreteras-ruta-bici',
    title: 'Cómo evitar carreteras principales al crear una ruta en bici',
    description:
      'Consejos para priorizar carril bici y vías más tranquilas al planificar rutas ciclistas en PedalMap.',
    date: '2026-08-12',
    readMinutes: 5,
    tags: ['Seguridad', 'Planificar', 'Preferencias'],
    socialHook: 'Menos nacional, más carril: preferencias al crear la ruta',
    socialCaption:
      'Antes de salir: mira idoneidad y superficie. Ajusta preferencias y recalcula.\npedalmap.es/crear-ruta-bicicleta\n#ciclismo #seguridad #pedalmap',
    lead:
      'Nadie quiere acabar en una nacional “porque el GPS acorta”. Así usas PedalMap para **evitar carreteras principales** y priorizar opciones más ciclistas.',
    primaryCta: { to: '/route-planner', label: 'Calcular ruta con preferencias' },
    secondaryCtas: [
      { to: '/crear-ruta-bicicleta', label: 'Guía crear ruta' },
      { to: '/planificador-rutas-bici', label: 'Planificador' },
    ],
    blocks: [
      {
        type: 'h2',
        text: 'Usa el perfil de bici correcto',
      },
      {
        type: 'p',
        text: 'Urbana y carretera no son lo mismo que gravel/MTB. El perfil cambia qué vías prioriza el motor — [elegir perfil](/blog/elegir-perfil-bici).',
      },
      {
        type: 'h2',
        text: 'Revisa idoneidad y superficie',
      },
      {
        type: 'p',
        text: 'Tras calcular, mira el % de idoneidad y la mezcla de suelos. Si ves demasiado tráfico potencial, cambia preferencias (carril bici / evitar principales) o añade un waypoint y vuelve a crear la ruta.',
      },
      {
        type: 'h2',
        text: 'No improvises el día D',
      },
      {
        type: 'p',
        text: 'Exporta [GPX](/crear-ruta-gpx) cuando el track te convenza. En ciudad, combina con sentido común y señalización local.',
      },
    ],
    relatedPaths: [
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta' },
      { to: '/blog/elegir-perfil-bici', label: 'Perfiles' },
      { to: '/blog/primera-ruta-pedalmap', label: 'Primera ruta' },
    ],
  },
  {
    slug: 'mejor-planificador-rutas-bici-espana',
    title: 'Qué mirar en un planificador de rutas bici en España (checklist)',
    description:
      'Checklist para elegir planificador de rutas ciclistas en España: perfil de bici, desnivel, viento, GPX y límites Free.',
    date: '2026-08-12',
    readMinutes: 6,
    tags: ['Planificar', 'Comparativa', 'España'],
    socialHook: 'Checklist: qué pedir a un planificador de rutas bici',
    socialCaption:
      'Perfil de bici + desnivel + viento + GPX. Sin red social obligatoria.\npedalmap.es/mejor-planificador-rutas-bici\n#ciclismo #pedalmap',
    lead:
      'Antes de decidir “el mejor” planificador, usa esta **checklist**. Spoiler: PedalMap está diseñado para marcarla en el contexto España.',
    primaryCta: { to: '/mejor-planificador-rutas-bici', label: 'Ver PedalMap como planificador' },
    secondaryCtas: [
      { to: '/alternativa-komoot', label: 'Alternativa a Komoot' },
      { to: '/route-planner', label: 'Probar ahora' },
    ],
    blocks: [
      {
        type: 'h2',
        text: '1) Perfil según tu bici',
      },
      {
        type: 'p',
        text: 'Carretera ≠ gravel ≠ MTB. Si el planificador no distingue, acabarás en el firme equivocado — [perfiles](/blog/elegir-perfil-bici).',
      },
      {
        type: 'h2',
        text: '2) Desnivel y superficie visibles',
      },
      {
        type: 'p',
        text: 'Los km mienten. Necesitas [desnivel](/blog/calcular-desnivel-ruta-bici) y composición de suelo antes de salir.',
      },
      {
        type: 'h2',
        text: '3) Viento relativo a la ruta',
      },
      {
        type: 'p',
        text: 'No basta el “viento en la ciudad”: importa el sentido del recorrido — [viento en la ruta](/blog/viento-en-la-ruta).',
      },
      {
        type: 'h2',
        text: '4) GPX a tu GPS',
      },
      {
        type: 'p',
        text: 'Garmin, Wahoo, OsmAnd… sin GPX el plan se queda en la pantalla — [crear ruta GPX](/crear-ruta-gpx).',
      },
      {
        type: 'h2',
        text: '5) Límites claros Free / pago',
      },
      {
        type: 'p',
        text: 'Prueba sin sorpresas: [Free vs Premium](/blog/free-vs-premium). PedalMap: [planificador](/planificador-rutas-bici) en pedalmap.es.',
      },
    ],
    relatedPaths: [
      { to: '/mejor-planificador-rutas-bici', label: 'Landing planificador ES' },
      { to: '/blog/alternativa-komoot-espana', label: 'vs Komoot' },
      { to: '/planificador-rutas-bici', label: 'Guía planificador' },
    ],
  },
  {
    slug: 'compartir-ruta-grupeta',
    title: 'Cómo preparar y compartir una ruta para la grupeta',
    description:
      'Prepara la salida de la grupeta: calcula ruta, revisa desnivel y viento, exporta GPX y compártela con claridad.',
    date: '2026-08-12',
    readMinutes: 5,
    tags: ['Grupeta', 'GPX', 'Comunidad'],
    socialHook: 'Grupeta sin “¿por dónde vamos?”: ruta + GPX + desnivel',
    socialCaption:
      'Calcula, mira metros y viento, exporta GPX y pásalo al chat.\npedalmap.es/crear-ruta-bicicleta\n#grupeta #ciclismo #pedalmap',
    lead:
      'La mejor publicidad de PedalMap es una **grupeta que sale con plan**. Así preparas la ruta y la compartes sin caos en el chat.',
    primaryCta: { to: '/route-planner', label: 'Preparar la ruta ahora' },
    secondaryCtas: [
      { to: '/crear-ruta-gpx', label: 'Exportar GPX' },
      { to: '/ruta-circular-bicicleta', label: 'Circular / Objetivo' },
    ],
    blocks: [
      {
        type: 'h2',
        text: '1) Cuadra km y desnivel con el nivel del grupo',
      },
      {
        type: 'p',
        text: 'Usa origen–destino o [Objetivo circular](/ruta-circular-bicicleta). Revisa [desnivel](/blog/calcular-desnivel-ruta-bici) antes de mandar el track.',
      },
      {
        type: 'h2',
        text: '2) Mira el viento',
      },
      {
        type: 'p',
        text: 'Un “suave” en el valle puede ser pared de cara a la vuelta — [viento en la ruta](/blog/viento-en-la-ruta).',
      },
      {
        type: 'h2',
        text: '3) Exporta GPX y pásalo limpio',
      },
      {
        type: 'p',
        text: 'Un solo archivo GPX + resumen (km, m+, hora). Tutoriales [Garmin](/blog/exportar-gpx-garmin) / [Wahoo](/blog/pasar-ruta-wahoo). Si alguien usa solo el móvil: [OsmAnd / Organic Maps](/blog/gpx-osmand-organic-maps).',
      },
      {
        type: 'h2',
        text: '4) Deja feedback útil',
      },
      {
        type: 'p',
        text: 'Si el routing falla en vuestra zona, escribid a soporte: mejora el producto y el SEO local con uso real.',
      },
    ],
    relatedPaths: [
      { to: '/crear-ruta-bicicleta', label: 'Crear ruta' },
      { to: '/blog/exportar-gpx-garmin', label: 'GPX Garmin' },
      { to: '/blog/ruta-circular-objetivo', label: 'Objetivo' },
    ],
  },
]

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug)
}

/** Plain paragraphs for prerender / search (links expanded to "text (url)"). */
export function postPlainParagraphs(post: BlogPost): string[] {
  const out = [post.lead.replace(/\*\*/g, '')]
  for (const b of post.blocks) {
    if (b.type === 'h2') out.push(b.text)
    else out.push(b.text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1').replace(/\*\*/g, ''))
  }
  return out
}
