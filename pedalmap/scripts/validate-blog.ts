/**
 * Validates blog batches (unique slugs, required fields) before build/deploy.
 * Usage: npx vite-node scripts/validate-blog.ts
 */
import { blogPosts } from '../src/content/blogPosts'

const slugs = new Set<string>()
const errors: string[] = []

for (const p of blogPosts) {
  if (!p.slug || !/^[a-z0-9-]+$/.test(p.slug)) {
    errors.push(`Invalid slug: ${p.slug}`)
  }
  if (slugs.has(p.slug)) errors.push(`Duplicate slug: ${p.slug}`)
  slugs.add(p.slug)
  if (!p.title || !p.description || !p.lead || !p.date) {
    errors.push(`Missing fields on ${p.slug}`)
  }
  if (!p.blocks?.length) errors.push(`No blocks on ${p.slug}`)
  if (!p.primaryCta?.to) errors.push(`No CTA on ${p.slug}`)
}

if (errors.length) {
  console.error('Blog validation failed:')
  for (const e of errors) console.error(' -', e)
  process.exit(1)
}

console.log(`OK: ${blogPosts.length} blog posts, slugs unique`)
