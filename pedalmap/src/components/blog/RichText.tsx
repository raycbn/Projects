import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g
const BOLD_RE = /\*\*([^*]+)\*\*/g

/** Renders markdown-ish [label](/path) and **bold** for blog copy. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const nodes: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  const re = new RegExp(LINK_RE.source, 'g')
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(<Fragment key={`t-${last}`}>{formatBold(text.slice(last, match.index))}</Fragment>)
    }
    const href = match[2]
    const label = match[1]
    if (href.startsWith('/')) {
      nodes.push(
        <Link
          key={`l-${match.index}`}
          to={href}
          className="font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline"
        >
          {label}
        </Link>,
      )
    } else {
      nodes.push(
        <a
          key={`a-${match.index}`}
          href={href}
          className="font-semibold text-[var(--color-trail)] underline-offset-2 hover:underline"
          rel="noopener noreferrer"
        >
          {label}
        </a>,
      )
    }
    last = match.index + match[0].length
  }
  if (last < text.length) {
    nodes.push(<Fragment key={`t-end`}>{formatBold(text.slice(last))}</Fragment>)
  }
  return <span className={className}>{nodes}</span>
}

function formatBold(chunk: string): ReactNode {
  const parts: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  const re = new RegExp(BOLD_RE.source, 'g')
  while ((m = re.exec(chunk)) !== null) {
    if (m.index > last) parts.push(chunk.slice(last, m.index))
    parts.push(
      <strong key={`b-${m.index}`} className="font-semibold text-[var(--color-forest)]">
        {m[1]}
      </strong>,
    )
    last = m.index + m[0].length
  }
  if (last < chunk.length) parts.push(chunk.slice(last))
  return parts.length === 1 ? parts[0] : parts
}
