import { type ReactNode } from 'react';
import { cn } from '../cn';

// ---------------------------------------------------------------------------
// Minimal markdown renderer for assistant output.
//
// Handwritten in lieu of a dependency: react-markdown pulls a 30-package
// remark/rehype subtree, marked has XSS surface, and LLMs only ever produce
// a small subset of CommonMark — fenced code, headings, lists (ordered +
// unordered, nested), blockquotes, horizontal rules, paragraphs, plus inline
// emphasis / code / links. That's what we cover here.
//
// Inline rendering operates on plain strings only; we never dangerouslySetHTML
// so any unmatched delimiter just shows literal characters.
// ---------------------------------------------------------------------------

interface MarkdownProps {
  readonly text: string;
  readonly className?: string;
}

type Block =
  | { kind: 'code'; lang: string | null; content: string }
  | { kind: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; content: string }
  | { kind: 'hr' }
  | { kind: 'list'; ordered: boolean; items: ReadonlyArray<ListItem> }
  | { kind: 'quote'; lines: ReadonlyArray<string> }
  | { kind: 'paragraph'; content: string };

interface ListItem {
  readonly content: string;
  readonly children: ReadonlyArray<Block>;
}

const FENCE_RE = /^```([^\s`]*)\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const HR_RE = /^[-*_]{3,}\s*$/;
const ULIST_RE = /^(\s*)[-*+]\s+(.*)$/;
const OLIST_RE = /^(\s*)\d+\.\s+(.*)$/;
const QUOTE_RE = /^>\s?(.*)$/;

function parseBlocks(input: string): ReadonlyArray<Block> {
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    // Fenced code block.
    const fence = line.match(FENCE_RE);
    if (fence) {
      const lang = fence[1] && fence[1].length > 0 ? fence[1] : null;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !FENCE_RE.test(lines[i] ?? '')) {
        buf.push(lines[i] ?? '');
        i++;
      }
      i++; // skip closing fence (or eof)
      blocks.push({ kind: 'code', lang, content: buf.join('\n') });
      continue;
    }

    if (line.trim().length === 0) {
      i++;
      continue;
    }

    // ATX heading.
    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = Math.min(heading[1]!.length, 6) as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ kind: 'heading', level, content: heading[2]!.trim() });
      i++;
      continue;
    }

    // Horizontal rule.
    if (HR_RE.test(line)) {
      blocks.push({ kind: 'hr' });
      i++;
      continue;
    }

    // Blockquote: consume contiguous `>` lines.
    if (QUOTE_RE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length) {
        const m = (lines[i] ?? '').match(QUOTE_RE);
        if (!m) break;
        buf.push(m[1] ?? '');
        i++;
      }
      blocks.push({ kind: 'quote', lines: buf });
      continue;
    }

    // List (ordered or unordered): consume contiguous matching lines.
    const ulist = line.match(ULIST_RE);
    const olist = line.match(OLIST_RE);
    if (ulist || olist) {
      const ordered = !!olist;
      const re = ordered ? OLIST_RE : ULIST_RE;
      const items: ListItem[] = [];
      while (i < lines.length) {
        const m = (lines[i] ?? '').match(re);
        if (!m) break;
        // Indent depth (number of leading spaces) is currently unused — flat lists only.
        // Future: nest based on indent.
        items.push({ content: m[2]!.trim(), children: [] });
        i++;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }

    // Paragraph: consume until blank line / fence / heading / hr / list / quote.
    const paraBuf: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i] ?? '';
      if (
        next.trim().length === 0 ||
        FENCE_RE.test(next) ||
        HEADING_RE.test(next) ||
        HR_RE.test(next) ||
        ULIST_RE.test(next) ||
        OLIST_RE.test(next) ||
        QUOTE_RE.test(next)
      ) {
        break;
      }
      paraBuf.push(next);
      i++;
    }
    blocks.push({ kind: 'paragraph', content: paraBuf.join('\n') });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Inline rendering — bold, italic, inline code, links.
// We tokenize manually instead of using regex with backreferences, which keeps
// nested emphasis predictable and means an unmatched delimiter renders as a
// literal char rather than swallowing the rest of the line.
// ---------------------------------------------------------------------------

function renderInline(input: string, keyPrefix: string): ReactNode {
  const out: ReactNode[] = [];
  let buf = '';
  let i = 0;
  let keyN = 0;
  const flush = () => {
    if (buf.length > 0) {
      out.push(buf);
      buf = '';
    }
  };
  const nextKey = () => `${keyPrefix}-${keyN++}`;

  while (i < input.length) {
    const ch = input[i];

    // Inline code: `...`
    if (ch === '`') {
      const end = input.indexOf('`', i + 1);
      if (end > i) {
        flush();
        out.push(
          <code key={nextKey()} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.875em]">
            {input.slice(i + 1, end)}
          </code>,
        );
        i = end + 1;
        continue;
      }
    }

    // Bold: **...** or __...__
    if ((ch === '*' || ch === '_') && input[i + 1] === ch) {
      const delim = ch + ch;
      const end = input.indexOf(delim, i + 2);
      if (end > i) {
        flush();
        out.push(
          <strong key={nextKey()} className="font-semibold">
            {renderInline(input.slice(i + 2, end), `${keyPrefix}-b${keyN}`)}
          </strong>,
        );
        i = end + 2;
        continue;
      }
    }

    // Italic: *...* or _..._  (single delimiter, not adjacent to another)
    if ((ch === '*' || ch === '_') && input[i + 1] !== ch) {
      // Don't pick up a stray underscore in identifiers like foo_bar_baz.
      const prev = input[i - 1];
      const isWordBoundary = !prev || /\s|[(\[{,.!?]/.test(prev);
      if (isWordBoundary) {
        const end = input.indexOf(ch, i + 1);
        if (end > i && input[end - 1] !== ch) {
          flush();
          out.push(
            <em key={nextKey()}>
              {renderInline(input.slice(i + 1, end), `${keyPrefix}-i${keyN}`)}
            </em>,
          );
          i = end + 1;
          continue;
        }
      }
    }

    // Link: [text](url)
    if (ch === '[') {
      const closeBracket = input.indexOf(']', i + 1);
      if (closeBracket > i && input[closeBracket + 1] === '(') {
        const closeParen = input.indexOf(')', closeBracket + 2);
        if (closeParen > closeBracket) {
          const label = input.slice(i + 1, closeBracket);
          const url = input.slice(closeBracket + 2, closeParen);
          // Allow only http/https/mailto to avoid javascript: schemes.
          const safe = /^(https?:|mailto:)/i.test(url);
          flush();
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
            );
          } else {
            out.push(label);
          }
          i = closeParen + 1;
          continue;
        }
      }
    }

    buf += ch;
    i++;
  }

  flush();
  return out.length === 1 ? out[0] : <>{out}</>;
}

// ---------------------------------------------------------------------------
// Block rendering
// ---------------------------------------------------------------------------

function renderBlock(block: Block, idx: number): ReactNode {
  const key = `b-${idx}`;
  switch (block.kind) {
    case 'code':
      return (
        <pre
          key={key}
          className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed text-foreground"
        >
          <code>{block.content}</code>
        </pre>
      );
    case 'heading': {
      const sizes: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
        1: 'text-lg font-semibold',
        2: 'text-base font-semibold',
        3: 'text-base font-semibold',
        4: 'text-sm font-semibold',
        5: 'text-sm font-semibold',
        6: 'text-sm font-semibold',
      };
      const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      return (
        <Tag key={key} className={cn('mt-2', sizes[block.level])}>
          {renderInline(block.content, key)}
        </Tag>
      );
    }
    case 'hr':
      return <hr key={key} className="my-2 border-border" />;
    case 'list':
      if (block.ordered) {
        return (
          <ol key={key} className="ml-5 list-decimal space-y-1">
            {block.items.map((item, j) => (
              <li key={`${key}-${j}`}>{renderInline(item.content, `${key}-${j}`)}</li>
            ))}
          </ol>
        );
      }
      return (
        <ul key={key} className="ml-5 list-disc space-y-1">
          {block.items.map((item, j) => (
            <li key={`${key}-${j}`}>{renderInline(item.content, `${key}-${j}`)}</li>
          ))}
        </ul>
      );
    case 'quote':
      return (
        <blockquote key={key} className="border-l-2 border-border pl-3 text-muted-foreground">
          {block.lines.map((ln, j) => (
            <p key={`${key}-${j}`}>{renderInline(ln, `${key}-${j}`)}</p>
          ))}
        </blockquote>
      );
    case 'paragraph':
      return (
        <p key={key} className="whitespace-pre-wrap leading-relaxed">
          {renderInline(block.content, key)}
        </p>
      );
  }
}

export function Markdown({ text, className }: MarkdownProps) {
  const blocks = parseBlocks(text);
  return (
    <div className={cn('flex flex-col gap-2 text-base text-foreground', className)}>
      {blocks.map(renderBlock)}
    </div>
  );
}
