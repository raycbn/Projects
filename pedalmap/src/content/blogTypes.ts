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
