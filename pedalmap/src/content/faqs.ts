import { FREE_LIMITS } from '@/domain/types'

export interface FaqItem {
  q: string
  a: string
}

/** Shared FAQs for landing UI + FAQPage JSON-LD (GEO / rich results). */
export const landingFaqs: FaqItem[] = [
  {
    q: '¿Qué es PedalMap?',
    a: 'PedalMap es un planificador de rutas de bicicleta pensado para España. Creas salidas con mapa, desnivel, viento y superficie según tu tipo de bici (carretera, urbana, gravel, MTB o e-bike), y puedes exportar GPX o navegar desde el móvil.',
  },
  {
    q: '¿Cómo crear una ruta en bicicleta?',
    a: 'Abre el planificador, busca dónde empiezas y dónde quieres llegar, elige el tipo de bici y pulsa Crear ruta. PedalMap calcula un recorrido real con distancia, tiempo, desnivel y composición de superficie.',
  },
  {
    q: '¿Qué cambia según el tipo de bici?',
    a: 'Carretera, urbana, gravel, MTB y e-bike usan Valhalla primero (tipo de bici + superficie en el cálculo), con ORS solo como respaldo. Verás un % de idoneidad de la mejor ruta encontrada.',
  },
  {
    q: '¿Cómo crear una ruta GPX?',
    a: 'Tras calcular la ruta, exporta GPX (1 gratis por semana en Free; ilimitado en Premium).',
  },
  {
    q: '¿Cómo calcular el desnivel de una ruta en bici?',
    a: 'Al calcular la ruta pedimos elevación al motor de routing y mostramos desnivel positivo/negativo y un gráfico interactivo sincronizado con el mapa.',
  },
  {
    q: '¿Cómo crear una ruta circular u Objetivo?',
    a: 'Objetivo incluye 1 prueba Free al mes. Elige el modo Objetivo, indica el punto de partida, los km y el desnivel. Generamos una circular con Valhalla primero (perfil de bici + superficie). Premium = Objetivo ilimitado.',
  },
  {
    q: '¿PedalMap es gratis?',
    a: `Sí: el plan Free incluye hasta ${FREE_LIMITS.maxRoutesSaved} rutas guardadas, ${FREE_LIMITS.maxRoutesCreatedPerMonth} creaciones al mes, 1 GPX a la semana, 1 Objetivo al mes y filtros básicos. Premium quita los techos y añade trial anual de 7 días.`,
  },
  {
    q: '¿PedalMap es una alternativa a Komoot?',
    a: 'Puede serlo si lo que buscas es planificar salidas en España con perfil de bici, desnivel, viento, superficie y GPX. No es una red social de tracks: es la capa previa a rodar. Comparativa en pedalmap.es/alternativa-komoot.',
  },
  {
    q: '¿Puedo planificar rutas gravel o MTB?',
    a: 'Sí. Elige el perfil gravel o MTB en el planificador para priorizar vías más coherentes con ese uso, revisa superficie y desnivel, y exporta GPX si quieres llevarla al GPS.',
  },
]
