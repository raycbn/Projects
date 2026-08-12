/**
 * Regenerates public/sitemap.xml from seoPages + blogPosts + static routes.
 * Run via: npx vite-node scripts/sync-sitemap.ts (also hooked from npm run build)
 */
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { seoPages } from '../src/content/seoPages'
import { blogPosts } from '../src/content/blogPosts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const out = join(root, 'public', 'sitemap.xml')

type Entry = { loc: string; changefreq: string; priority: string }

const staticEntries: Entry[] = [
  { loc: 'https://pedalmap.es/', changefreq: 'weekly', priority: '1.0' },
  { loc: 'https://pedalmap.es/route-planner', changefreq: 'weekly', priority: '0.9' },
  { loc: 'https://pedalmap.es/explorar', changefreq: 'weekly', priority: '0.8' },
  { loc: 'https://pedalmap.es/blog', changefreq: 'weekly', priority: '0.85' },
  { loc: 'https://pedalmap.es/premium', changefreq: 'monthly', priority: '0.5' },
  { loc: 'https://pedalmap.es/privacidad', changefreq: 'yearly', priority: '0.3' },
  { loc: 'https://pedalmap.es/cookies', changefreq: 'yearly', priority: '0.3' },
  { loc: 'https://pedalmap.es/terminos', changefreq: 'yearly', priority: '0.3' },
]

const seoEntries: Entry[] = seoPages.map((p) => ({
  loc: `https://pedalmap.es${p.path}`,
  changefreq: 'monthly',
  priority: p.kind === 'compare' || p.path === '/que-es-pedalmap' ? '0.9' : p.kind === 'intent' ? '0.85' : '0.75',
}))

const blogEntries: Entry[] = blogPosts.map((p) => ({
  loc: `https://pedalmap.es/blog/${p.slug}`,
  changefreq: 'monthly',
  priority: '0.8',
}))

const seen = new Set<string>()
const all: Entry[] = []
for (const e of [...staticEntries, ...seoEntries, ...blogEntries]) {
  if (seen.has(e.loc)) continue
  seen.add(e.loc)
  all.push(e)
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all
  .map(
    (e) =>
      `  <url><loc>${e.loc}</loc><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`,
  )
  .join('\n')}
</urlset>
`

writeFileSync(out, xml)
console.log(`sitemap.xml → ${all.length} URLs`)
