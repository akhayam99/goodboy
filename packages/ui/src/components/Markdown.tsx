import { type ReactNode } from 'react'
import { Activity, CheckCheck, FileEdit, HelpCircle, Target, type LucideIcon } from 'lucide-react'
import { cn } from '../cn'

type CtxTagStyle = {
  readonly icon: LucideIcon
  readonly label: string
  readonly iconClass: string
  readonly chipClass: string
  readonly calloutClass: string
  readonly calloutLabelClass: string
}

const CTX_DEFAULT: CtxTagStyle = {
  icon: Activity,
  label: '',
  iconClass: 'text-muted-foreground',
  chipClass: 'bg-muted text-muted-foreground',
  calloutClass: 'border-border-soft bg-muted/40',
  calloutLabelClass: 'text-muted-foreground',
}

const CTX_TAG_STYLES: ReadonlyArray<readonly [RegExp, CtxTagStyle]> = [
  [
    /^(ctx-?)?goal$/i,
    {
      icon: Target,
      label: 'goal',
      iconClass: 'text-primary',
      chipClass: 'bg-primary/10 text-primary',
      calloutClass: 'border-primary/20 bg-primary/5',
      calloutLabelClass: 'text-primary',
    },
  ],
  [
    /^(ctx-?)?(decision|decisions)$/i,
    {
      icon: CheckCheck,
      label: 'decision',
      iconClass: 'text-success',
      chipClass: 'bg-success/10 text-success',
      calloutClass: 'border-success/20 bg-success/5',
      calloutLabelClass: 'text-success',
    },
  ],
  [
    /^(ctx-?)?(question|questions|open-?questions)$/i,
    {
      icon: HelpCircle,
      label: 'question',
      iconClass: 'text-warning',
      chipClass: 'bg-warning/10 text-warning',
      calloutClass: 'border-warning/25 bg-warning/5',
      calloutLabelClass: 'text-warning',
    },
  ],
  [
    /^(ctx-?)?(output|last-?output|last-?output-?summary|summary)$/i,
    {
      icon: Activity,
      label: 'output',
      iconClass: 'text-info',
      chipClass: 'bg-info/10 text-info',
      calloutClass: 'border-info/20 bg-info/5',
      calloutLabelClass: 'text-info',
    },
  ],
  [
    /^(ctx-?)?(files?|files-?touched)$/i,
    {
      icon: FileEdit,
      label: 'files',
      iconClass: 'text-info',
      chipClass: 'bg-info/10 text-info',
      calloutClass: 'border-info/20 bg-info/5',
      calloutLabelClass: 'text-info',
    },
  ],
]

function ctxStyleForTag(tag: string): CtxTagStyle {
  const stripped = tag.replace(/^ctx-?/i, '')
  for (const [re, style] of CTX_TAG_STYLES) {
    if (re.test(tag) || re.test(stripped)) {
      return style
    }
  }
  return { ...CTX_DEFAULT, label: stripped || tag }
}

type MarkdownProps = {
  readonly text: string
  readonly className?: string
}

type CellAlign = 'left' | 'center' | 'right'

type Block =
  | { kind: 'code'; lang: string | null; content: string }
  | { kind: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; content: string }
  | { kind: 'hr' }
  | { kind: 'list'; ordered: boolean; items: ReadonlyArray<ListItem> }
  | { kind: 'quote'; lines: ReadonlyArray<string> }
  | {
      kind: 'table'
      headers: ReadonlyArray<string>
      align: ReadonlyArray<CellAlign>
      rows: ReadonlyArray<ReadonlyArray<string>>
    }
  | { kind: 'callout'; tag: string; content: string }
  | { kind: 'paragraph'; content: string }

type ListItem = {
  readonly content: string
  readonly children: ReadonlyArray<Block>
}

const FENCE_RE = /^```([^\s`]*)\s*$/
const HEADING_RE = /^(#{1,6})\s+(.*)$/
const HR_RE = /^[-*_]{3,}\s*$/
const ULIST_RE = /^(\s*)[-*+]\s+(.*)$/
const OLIST_RE = /^(\s*)\d+\.\s+(.*)$/
const QUOTE_RE = /^>\s?(.*)$/
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/
const TABLE_DIVIDER_RE = /^\s*\|?\s*:?-{2,}:?(\s*\|\s*:?-{2,}:?)*\s*\|?\s*$/
const CALLOUT_OPEN_RE = /^<<([a-zA-Z][a-zA-Z0-9_-]*)>>(.*)$/

function splitTableCells(line: string): ReadonlyArray<string> {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((c) => c.trim())
}

function parseAlign(divider: string): ReadonlyArray<CellAlign> {
  return splitTableCells(divider).map((c) => {
    const left = c.startsWith(':')
    const right = c.endsWith(':')
    if (left && right) {
      return 'center'
    }
    if (right) {
      return 'right'
    }
    return 'left'
  })
}

function parseBlocks(input: string): ReadonlyArray<Block> {
  const lines = input.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''

    const fence = line.match(FENCE_RE)
    if (fence) {
      const lang = fence[1] && fence[1].length > 0 ? fence[1] : null
      const buf: string[] = []
      i++
      while (i < lines.length && !FENCE_RE.test(lines[i] ?? '')) {
        buf.push(lines[i] ?? '')
        i++
      }
      i++
      blocks.push({ kind: 'code', lang, content: buf.join('\n') })
      continue
    }

    if (line.trim().length === 0) {
      i++
      continue
    }

    const heading = line.match(HEADING_RE)
    if (heading) {
      const level = Math.min(heading[1]!.length, 6) as 1 | 2 | 3 | 4 | 5 | 6
      blocks.push({ kind: 'heading', level, content: heading[2]!.trim() })
      i++
      continue
    }

    if (HR_RE.test(line)) {
      blocks.push({ kind: 'hr' })
      i++
      continue
    }

    if (
      TABLE_ROW_RE.test(line) &&
      i + 1 < lines.length &&
      TABLE_DIVIDER_RE.test(lines[i + 1] ?? '')
    ) {
      const headers = splitTableCells(line)
      const align = parseAlign(lines[i + 1] ?? '')
      i += 2
      const rows: string[][] = []
      while (i < lines.length && TABLE_ROW_RE.test(lines[i] ?? '')) {
        rows.push([...splitTableCells(lines[i] ?? '')])
        i++
      }
      blocks.push({ kind: 'table', headers, align, rows })
      continue
    }

    const calloutOpen = line.match(CALLOUT_OPEN_RE)
    if (calloutOpen) {
      const tag = calloutOpen[1]!
      const closeRe = new RegExp(`</${tag}>>?`)
      const buf: string[] = []
      const firstLineRest = calloutOpen[2] ?? ''
      const firstClose = firstLineRest.match(closeRe)
      if (firstClose && firstClose.index !== undefined) {
        buf.push(firstLineRest.slice(0, firstClose.index))
        i++
        blocks.push({ kind: 'callout', tag, content: buf.join('\n').trim() })
        continue
      }
      if (firstLineRest.length > 0) {
        buf.push(firstLineRest)
      }
      i++
      let closed = false
      while (i < lines.length) {
        const cur = lines[i] ?? ''
        const m = cur.match(closeRe)
        if (m && m.index !== undefined) {
          buf.push(cur.slice(0, m.index))
          i++
          closed = true
          break
        }
        buf.push(cur)
        i++
      }
      if (closed || buf.length > 0) {
        blocks.push({ kind: 'callout', tag, content: buf.join('\n').trim() })
        continue
      }
    }

    if (QUOTE_RE.test(line)) {
      const buf: string[] = []
      while (i < lines.length) {
        const m = (lines[i] ?? '').match(QUOTE_RE)
        if (!m) {
          break
        }
        buf.push(m[1] ?? '')
        i++
      }
      blocks.push({ kind: 'quote', lines: buf })
      continue
    }

    const ulist = line.match(ULIST_RE)
    const olist = line.match(OLIST_RE)
    if (ulist || olist) {
      const ordered = !!olist
      const re = ordered ? OLIST_RE : ULIST_RE
      const items: ListItem[] = []
      while (i < lines.length) {
        const m = (lines[i] ?? '').match(re)
        if (!m) {
          break
        }
        items.push({ content: m[2]!.trim(), children: [] })
        i++
      }
      blocks.push({ kind: 'list', ordered, items })
      continue
    }

    const paraBuf: string[] = [line]
    i++
    while (i < lines.length) {
      const next = lines[i] ?? ''
      const nextNext = lines[i + 1] ?? ''
      const tableStart = TABLE_ROW_RE.test(next) && TABLE_DIVIDER_RE.test(nextNext)
      if (
        next.trim().length === 0 ||
        FENCE_RE.test(next) ||
        HEADING_RE.test(next) ||
        HR_RE.test(next) ||
        ULIST_RE.test(next) ||
        OLIST_RE.test(next) ||
        QUOTE_RE.test(next) ||
        CALLOUT_OPEN_RE.test(next) ||
        tableStart
      ) {
        break
      }
      paraBuf.push(next)
      i++
    }
    blocks.push({ kind: 'paragraph', content: paraBuf.join('\n') })
  }

  return blocks
}

function renderInline(input: string, keyPrefix: string): ReactNode {
  const out: ReactNode[] = []
  let buf = ''
  let i = 0
  let keyN = 0
  const flush = () => {
    if (buf.length > 0) {
      out.push(buf)
      buf = ''
    }
  }
  const nextKey = () => `${keyPrefix}-${keyN++}`

  while (i < input.length) {
    const ch = input[i]

    if (ch === '<' && input[i + 1] === '<') {
      const close = input.indexOf('>>', i + 2)
      if (close > i) {
        const inner = input.slice(i + 2, close)
        if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(inner)) {
          flush()
          const style = ctxStyleForTag(inner)
          const Icon = style.icon
          const label = style.label || inner.replace(/^ctx-?/i, '') || inner
          out.push(
            <span
              key={nextKey()}
              className={cn(
                'mx-0.5 inline-flex items-center gap-2 rounded px-1.5 py-0.5 align-baseline text-[0.7em] font-semibold uppercase tracking-wide',
                style.chipClass,
              )}
            >
              <Icon size={10} aria-hidden />
              {label}
            </span>,
          )
          i = close + 2
          continue
        }
      }
    }

    if (ch === '`') {
      const end = input.indexOf('`', i + 1)
      if (end > i) {
        const inner = input.slice(i + 1, end)
        const ctxMatch = inner.match(/^<<([a-zA-Z][a-zA-Z0-9_-]*)>>$/)
        if (ctxMatch) {
          flush()
          const tag = ctxMatch[1]!
          const style = ctxStyleForTag(tag)
          const Icon = style.icon
          const label = style.label || tag.replace(/^ctx-?/i, '') || tag
          out.push(
            <span
              key={nextKey()}
              className={cn(
                'mx-0.5 inline-flex items-center gap-2 rounded px-1.5 py-0.5 align-baseline text-[0.7em] font-semibold uppercase tracking-wide',
                style.chipClass,
              )}
            >
              <Icon size={10} aria-hidden />
              {label}
            </span>,
          )
          i = end + 1
          continue
        }
        flush()
        out.push(
          <code
            key={nextKey()}
            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.875em] text-foreground"
          >
            {inner}
          </code>,
        )
        i = end + 1
        continue
      }
    }

    if ((ch === '*' || ch === '_') && input[i + 1] === ch) {
      const delim = ch + ch
      const end = input.indexOf(delim, i + 2)
      if (end > i) {
        flush()
        out.push(
          <strong key={nextKey()} className="font-semibold">
            {renderInline(input.slice(i + 2, end), `${keyPrefix}-b${keyN}`)}
          </strong>,
        )
        i = end + 2
        continue
      }
    }

    if ((ch === '*' || ch === '_') && input[i + 1] !== ch) {
      const prev = input[i - 1]
      const isWordBoundary = !prev || /\s|[(\[{,.!?]/.test(prev)
      if (isWordBoundary) {
        const end = input.indexOf(ch, i + 1)
        if (end > i && input[end - 1] !== ch) {
          flush()
          out.push(
            <em key={nextKey()}>
              {renderInline(input.slice(i + 1, end), `${keyPrefix}-i${keyN}`)}
            </em>,
          )
          i = end + 1
          continue
        }
      }
    }

    if (ch === '!' && input[i + 1] === '[') {
      const closeBracket = input.indexOf(']', i + 2)
      if (closeBracket > i && input[closeBracket + 1] === '(') {
        const closeParen = input.indexOf(')', closeBracket + 2)
        if (closeParen > closeBracket) {
          const alt = input.slice(i + 2, closeBracket)
          const url = input.slice(closeBracket + 2, closeParen).trim()
          const safe = /^https?:/i.test(url)
          flush()
          out.push(
            safe ? (
              <img
                key={nextKey()}
                src={url}
                alt={alt}
                loading="lazy"
                className="my-1.5 max-h-96 max-w-full rounded-md border border-border-soft object-contain"
              />
            ) : (
              alt
            ),
          )
          i = closeParen + 1
          continue
        }
      }
    }

    if (ch === '[') {
      const closeBracket = input.indexOf(']', i + 1)
      if (closeBracket > i && input[closeBracket + 1] === '(') {
        const closeParen = input.indexOf(')', closeBracket + 2)
        if (closeParen > closeBracket) {
          const label = input.slice(i + 1, closeBracket)
          const url = input.slice(closeBracket + 2, closeParen)
          const safe = /^(https?:|mailto:)/i.test(url)
          flush()
          if (safe) {
            out.push(
              <a
                key={nextKey()}
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary underline-offset-2 hover:underline"
              >
                {renderInline(label, `${keyPrefix}-l${keyN}`)}
              </a>,
            )
          } else {
            out.push(label)
          }
          i = closeParen + 1
          continue
        }
      }
    }

    buf += ch
    i++
  }

  flush()
  return out.length === 1 ? out[0] : <>{out}</>
}

function renderBlock(block: Block, idx: number): ReactNode {
  const key = `b-${idx}`
  switch (block.kind) {
    case 'code':
      return (
        <pre
          key={key}
          className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed text-foreground"
        >
          <code>{block.content}</code>
        </pre>
      )
    case 'heading': {
      const sizes: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
        1: 'text-lg font-semibold text-foreground',
        2: 'text-base font-semibold text-foreground',
        3: 'text-base font-medium text-foreground',
        4: 'text-sm font-medium text-foreground',
        5: 'text-sm font-medium text-foreground',
        6: 'text-sm font-medium text-foreground',
      }
      const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      return (
        <Tag key={key} className={sizes[block.level]}>
          {renderInline(block.content, key)}
        </Tag>
      )
    }
    case 'hr':
      return (
        <div
          key={key}
          role="separator"
          className="my-2 h-px w-full bg-gradient-to-r from-transparent via-border-soft to-transparent"
        />
      )
    case 'list':
      if (block.ordered) {
        return (
          <ol key={key} className="flex list-decimal flex-col gap-1.5 pl-5">
            {block.items.map((item, j) => (
              <li key={`${key}-${j}`} className="leading-relaxed">
                {renderInline(item.content, `${key}-${j}`)}
              </li>
            ))}
          </ol>
        )
      }
      return (
        <ul key={key} className="flex list-disc flex-col gap-1.5 pl-5">
          {block.items.map((item, j) => (
            <li key={`${key}-${j}`} className="leading-relaxed">
              {renderInline(item.content, `${key}-${j}`)}
            </li>
          ))}
        </ul>
      )
    case 'quote':
      return (
        <blockquote key={key} className="border-l-2 border-border pl-3 text-muted-foreground">
          {block.lines.map((ln, j) => (
            <p key={`${key}-${j}`}>{renderInline(ln, `${key}-${j}`)}</p>
          ))}
        </blockquote>
      )
    case 'table': {
      const alignClass = (a: CellAlign | undefined): string => {
        if (a === 'right') {
          return 'text-right'
        }
        if (a === 'center') {
          return 'text-center'
        }
        return 'text-left'
      }
      return (
        <div key={key} className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-soft/60">
                {block.headers.map((h, j) => (
                  <th
                    key={`${key}-h-${j}`}
                    className={cn(
                      'px-3 py-1.5 font-medium text-foreground/75',
                      alignClass(block.align[j]),
                    )}
                  >
                    {renderInline(h, `${key}-h-${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr
                  key={`${key}-r-${ri}`}
                  className="border-b border-border-soft/50 last:border-b-0"
                >
                  {row.map((cell, ci) => (
                    <td
                      key={`${key}-r-${ri}-c-${ci}`}
                      className={cn('px-3 py-1.5 align-top', alignClass(block.align[ci]))}
                    >
                      {renderInline(cell, `${key}-r-${ri}-c-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    case 'callout': {
      const style = ctxStyleForTag(block.tag)
      const Icon = style.icon
      const label = style.label || block.tag.replace(/^ctx-?/i, '') || block.tag
      return (
        <div key={key} className={cn('rounded-md border p-3 text-sm', style.calloutClass)}>
          <div
            className={cn(
              'mb-1 inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide',
              style.calloutLabelClass,
            )}
          >
            <Icon size={11} aria-hidden className={style.iconClass} />
            {label}
          </div>
          <div className="whitespace-pre-wrap leading-relaxed text-foreground/90">
            {renderInline(block.content, key)}
          </div>
        </div>
      )
    }
    case 'paragraph': {
      const isTree = /[├└│┌┐┘┤┬┼]/.test(block.content)
      return (
        <p
          key={key}
          className={cn(
            'whitespace-pre-wrap leading-relaxed',
            isTree && 'overflow-x-auto font-mono',
          )}
        >
          {renderInline(block.content, key)}
        </p>
      )
    }
  }
}

export const Markdown = ({ text, className }: MarkdownProps) => {
  const blocks = parseBlocks(text)
  return (
    <div className={cn('flex flex-col gap-2 text-sm text-foreground/85', className)}>
      {blocks.map(renderBlock)}
    </div>
  )
}
