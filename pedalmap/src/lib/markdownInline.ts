/** Inline markdown: [label](/path) and **bold** → safe-ish HTML for prerender. */
export function markdownLinksToHtml(text: string): string {
  const escaped = text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_full, label: string, href: string) => {
      const safeHref = String(href).replace(/"/g, '')
      return `<a href="${safeHref}">${label}</a>`
    })
}
