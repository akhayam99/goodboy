import { type ReactNode } from 'react';
import { cn } from '../../cn';

const MARKER = 'text-muted-foreground/50';

type InlineRule = {
  readonly open: string;
  readonly close: string;
  readonly className: string;
};

const INLINE_RULES: ReadonlyArray<InlineRule> = [
  { open: '**', close: '**', className: 'font-semibold' },
  { open: '__', close: '__', className: 'font-semibold' },
  { open: '~~', close: '~~', className: 'line-through' },
  { open: '*', close: '*', className: 'italic' },
  { open: '_', close: '_', className: 'italic' },
];

function pushText(out: ReactNode[], text: string, key: string) {
  if (text.length > 0) out.push(<span key={key}>{text}</span>);
}

function decorateInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let buf = '';
  let i = 0;
  let n = 0;
  const flush = () => {
    if (buf.length > 0) {
      pushText(out, buf, `${keyPrefix}-t${n++}`);
      buf = '';
    }
  };

  while (i < text.length) {
    const ch = text[i];

    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i) {
        flush();
        const inner = text.slice(i + 1, end);
        out.push(
          <span key={`${keyPrefix}-c${n++}`}>
            <span className={MARKER}>`</span>
            <span className="rounded-sm bg-muted/60 font-mono">{inner}</span>
            <span className={MARKER}>`</span>
          </span>,
        );
        i = end + 1;
        continue;
      }
    }

    let matched = false;
    for (const rule of INLINE_RULES) {
      if (!text.startsWith(rule.open, i)) continue;
      const contentStart = i + rule.open.length;
      const end = text.indexOf(rule.close, contentStart);
      if (end < contentStart) continue;
      const inner = text.slice(contentStart, end);
      if (inner.length === 0) continue;
      if (rule.open === '*' && (text[i + 1] === '*' || text[i - 1] === '*')) continue;
      if (rule.open === '_' && (text[i + 1] === '_' || text[i - 1] === '_')) continue;
      flush();
      out.push(
        <span key={`${keyPrefix}-e${n++}`}>
          <span className={MARKER}>{rule.open}</span>
          <span className={rule.className}>{inner}</span>
          <span className={MARKER}>{rule.close}</span>
        </span>,
      );
      i = end + rule.close.length;
      matched = true;
      break;
    }
    if (matched) continue;

    buf += ch;
    i++;
  }

  flush();
  return out;
}

const HEADING_RE = /^(\s*)(#{1,3})(\s+)(.*)$/;
const QUOTE_RE = /^(\s*)(>)(\s+)(.*)$/;
const ULIST_RE = /^(\s*)([-*+])(\s+)(.*)$/;
const OLIST_RE = /^(\s*)(\d+\.)(\s+)(.*)$/;

const HEADING_SIZE: Record<number, string> = {
  1: 'text-base font-bold',
  2: 'text-[0.95rem] font-bold',
  3: 'font-semibold',
};

function decorateLine(line: string, key: string): ReactNode {
  const heading = line.match(HEADING_RE);
  if (heading) {
    const [, indent, hashes, space, rest] = heading;
    const level = hashes!.length;
    return (
      <span key={key} className={cn(HEADING_SIZE[level])}>
        {indent}
        <span className={MARKER}>{hashes}</span>
        {space}
        {decorateInline(rest ?? '', key)}
      </span>
    );
  }

  const quote = line.match(QUOTE_RE);
  if (quote) {
    const [, indent, marker, space, rest] = quote;
    return (
      <span key={key} className="text-muted-foreground">
        {indent}
        <span className="text-primary/60">{marker}</span>
        {space}
        {decorateInline(rest ?? '', key)}
      </span>
    );
  }

  const olist = line.match(OLIST_RE);
  const ulist = line.match(ULIST_RE);
  const list = olist ?? ulist;
  if (list) {
    const [, indent, marker, space, rest] = list;
    return (
      <span key={key}>
        {indent}
        <span className={MARKER}>{marker}</span>
        {space}
        {decorateInline(rest ?? '', key)}
      </span>
    );
  }

  return <span key={key}>{decorateInline(line, key)}</span>;
}

export function decorate(text: string): ReactNode {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, idx) => (
        <span key={`ln-${idx}`}>
          {decorateLine(line, `ln-${idx}`)}
          {idx < lines.length - 1 ? '\n' : null}
        </span>
      ))}
    </>
  );
}
