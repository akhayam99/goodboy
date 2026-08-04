export type CellAlign = 'left' | 'center' | 'right';

export type Block =
  | { kind: 'code'; lang: string | null; content: string }
  | { kind: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; content: string }
  | { kind: 'hr' }
  | { kind: 'list'; ordered: boolean; items: ReadonlyArray<ListItem> }
  | { kind: 'quote'; lines: ReadonlyArray<string> }
  | {
      kind: 'table';
      headers: ReadonlyArray<string>;
      align: ReadonlyArray<CellAlign>;
      rows: ReadonlyArray<ReadonlyArray<string>>;
    }
  | { kind: 'callout'; tag: string; content: string }
  | { kind: 'paragraph'; content: string; isTree: boolean };

export type ListItem = {
  readonly content: string;
  readonly children: ReadonlyArray<Block>;
};

const FENCE_RE = /^```([^\s`]*)\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const HR_RE = /^[-*_]{3,}\s*$/;
const ULIST_RE = /^(\s*)[-*+]\s+(.*)$/;
const OLIST_RE = /^(\s*)\d+\.\s+(.*)$/;
const QUOTE_RE = /^>\s?(.*)$/;
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const TABLE_DIVIDER_RE = /^\s*\|?\s*:?-{2,}:?(\s*\|\s*:?-{2,}:?)*\s*\|?\s*$/;
const CALLOUT_OPEN_RE = /^<<([a-zA-Z][a-zA-Z0-9_-]*)>>(.*)$/;
const TREE_RE = /[├└│┌┐┘┤┬┼]/;

type Params = {
  readonly lines: ReadonlyArray<string>;
};

const joinParagraphLines = ({ lines }: Params): string => {
  let content = '';

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? '';
    const isLastLine = lineIndex === lines.length - 1;
    if (isLastLine) {
      content += line;
      continue;
    }
    if (/ {2,}$/.test(line)) {
      content += `${line.replace(/ {2,}$/, '')}\n`;
      continue;
    }
    if (line.endsWith('\\')) {
      content += `${line.slice(0, -1)}\n`;
      continue;
    }
    content += `${line} `;
  }

  return content;
};

function splitTableCells(line: string): ReadonlyArray<string> {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

function parseAlign(divider: string): ReadonlyArray<CellAlign> {
  return splitTableCells(divider).map((c) => {
    const left = c.startsWith(':');
    const right = c.endsWith(':');
    if (left && right) {
      return 'center';
    }
    if (right) {
      return 'right';
    }
    return 'left';
  });
}

type RawListItem = {
  readonly indent: number;
  readonly ordered: boolean;
  readonly content: string;
};

const matchListLine = (line: string): RawListItem | null => {
  const ulist = line.match(ULIST_RE);
  if (ulist) {
    return { indent: (ulist[1] ?? '').length, ordered: false, content: (ulist[2] ?? '').trim() };
  }
  const olist = line.match(OLIST_RE);
  if (olist) {
    return { indent: (olist[1] ?? '').length, ordered: true, content: (olist[2] ?? '').trim() };
  }
  return null;
};

type CollectParams = {
  readonly raws: ReadonlyArray<RawListItem>;
  readonly cursor: { index: number };
  readonly indent: number;
  readonly ordered: boolean;
};

const collectListItems = ({ raws, cursor, indent, ordered }: CollectParams): ListItem[] => {
  const items: ListItem[] = [];

  while (cursor.index < raws.length) {
    const raw = raws[cursor.index]!;
    if (raw.indent < indent) {
      break;
    }
    if (raw.indent > indent) {
      const nested = collectListItems({
        raws,
        cursor,
        indent: raw.indent,
        ordered: raw.ordered,
      });
      const last = items[items.length - 1];
      if (last === undefined) {
        items.push(...nested);
        continue;
      }
      items[items.length - 1] = {
        content: last.content,
        children: [...last.children, { kind: 'list', ordered: raw.ordered, items: nested }],
      };
      continue;
    }
    if (raw.ordered !== ordered) {
      break;
    }
    items.push({ content: raw.content, children: [] });
    cursor.index++;
  }

  return items;
};

const isTagNameStart = (ch: string | undefined): boolean =>
  ch !== undefined && ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z'));

const stripHtml = (input: string): string => {
  let out = '';
  let i = 0;
  let inFence = false;
  const n = input.length;

  while (i < n) {
    const atLineStart = i === 0 || input[i - 1] === '\n';
    if (atLineStart && input.startsWith('```', i)) {
      const lineEnd = input.indexOf('\n', i);
      const end = lineEnd === -1 ? n : lineEnd;
      out += input.slice(i, end);
      i = end;
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      out += input[i];
      i++;
      continue;
    }

    const ch = input[i];

    if (ch === '`') {
      const end = input.indexOf('`', i + 1);
      if (end !== -1) {
        out += input.slice(i, end + 1);
        i = end + 1;
        continue;
      }
    }

    if (ch === '<' && input.startsWith('<!--', i)) {
      const end = input.indexOf('-->', i + 4);
      if (end !== -1) {
        i = end + 3;
        continue;
      }
    }

    if (ch === '<' && input[i + 1] === '<') {
      out += '<<';
      i += 2;
      continue;
    }

    if (ch === '<') {
      const slashed = input[i + 1] === '/';
      const nameStart = slashed ? input[i + 2] : input[i + 1];
      if (isTagNameStart(nameStart)) {
        const end = input.indexOf('>', i + 1);
        if (end !== -1) {
          i = end + 1;
          continue;
        }
      }
    }

    out += ch;
    i++;
  }

  return out.replace(/&nbsp;/g, ' ');
};

function parseBlocks(input: string): ReadonlyArray<Block> {
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    const fence = line.match(FENCE_RE);
    if (fence) {
      const lang = fence[1] && fence[1].length > 0 ? fence[1] : null;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !FENCE_RE.test(lines[i] ?? '')) {
        buf.push(lines[i] ?? '');
        i++;
      }
      i++;
      blocks.push({ kind: 'code', lang, content: buf.join('\n') });
      continue;
    }

    if (line.trim().length === 0) {
      i++;
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = Math.min(heading[1]!.length, 6) as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ kind: 'heading', level, content: heading[2]!.trim() });
      i++;
      continue;
    }

    if (HR_RE.test(line)) {
      blocks.push({ kind: 'hr' });
      i++;
      continue;
    }

    if (
      TABLE_ROW_RE.test(line) &&
      i + 1 < lines.length &&
      TABLE_DIVIDER_RE.test(lines[i + 1] ?? '')
    ) {
      const headers = splitTableCells(line);
      const align = parseAlign(lines[i + 1] ?? '');
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && TABLE_ROW_RE.test(lines[i] ?? '')) {
        rows.push([...splitTableCells(lines[i] ?? '')]);
        i++;
      }
      blocks.push({ kind: 'table', headers, align, rows });
      continue;
    }

    const calloutOpen = line.match(CALLOUT_OPEN_RE);
    if (calloutOpen) {
      const tag = calloutOpen[1]!;
      const closeRe = new RegExp(`</${tag}>>?`);
      const buf: string[] = [];
      const firstLineRest = calloutOpen[2] ?? '';
      const firstClose = firstLineRest.match(closeRe);
      if (firstClose && firstClose.index !== undefined) {
        buf.push(firstLineRest.slice(0, firstClose.index));
        i++;
        blocks.push({ kind: 'callout', tag, content: buf.join('\n').trim() });
        continue;
      }
      if (firstLineRest.length > 0) {
        buf.push(firstLineRest);
      }
      i++;
      let closed = false;
      while (i < lines.length) {
        const cur = lines[i] ?? '';
        const m = cur.match(closeRe);
        if (m && m.index !== undefined) {
          buf.push(cur.slice(0, m.index));
          i++;
          closed = true;
          break;
        }
        buf.push(cur);
        i++;
      }
      if (closed || buf.length > 0) {
        blocks.push({ kind: 'callout', tag, content: buf.join('\n').trim() });
        continue;
      }
    }

    if (QUOTE_RE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length) {
        const m = (lines[i] ?? '').match(QUOTE_RE);
        if (!m) {
          break;
        }
        buf.push(m[1] ?? '');
        i++;
      }
      blocks.push({ kind: 'quote', lines: buf });
      continue;
    }

    const listStart = matchListLine(line);
    if (listStart) {
      const raws: RawListItem[] = [];
      while (i < lines.length) {
        const current = lines[i] ?? '';
        const raw = matchListLine(current);
        if (raw) {
          raws.push(raw);
          i++;
          continue;
        }
        if (current.trim().length === 0) {
          let ahead = i + 1;
          while (ahead < lines.length && (lines[ahead] ?? '').trim().length === 0) {
            ahead++;
          }
          const next = ahead < lines.length ? matchListLine(lines[ahead] ?? '') : null;
          if (next && next.indent >= listStart.indent) {
            i = ahead;
            continue;
          }
        }
        break;
      }

      const cursor = { index: 0 };
      while (cursor.index < raws.length) {
        const head = raws[cursor.index]!;
        const items = collectListItems({
          raws,
          cursor,
          indent: head.indent,
          ordered: head.ordered,
        });
        blocks.push({ kind: 'list', ordered: head.ordered, items });
      }
      continue;
    }

    const paraBuf: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i] ?? '';
      const nextNext = lines[i + 1] ?? '';
      const tableStart = TABLE_ROW_RE.test(next) && TABLE_DIVIDER_RE.test(nextNext);
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
        break;
      }
      paraBuf.push(next);
      i++;
    }
    const isTree = paraBuf.some((paragraphLine) => TREE_RE.test(paragraphLine));
    blocks.push({
      kind: 'paragraph',
      content: isTree ? paraBuf.join('\n') : joinParagraphLines({ lines: paraBuf }),
      isTree,
    });
  }

  return blocks;
}

const toSections = (blocks: ReadonlyArray<Block>): ReadonlyArray<ReadonlyArray<Block>> => {
  const sections: Block[][] = [];
  let current: Block[] = [];

  for (const block of blocks) {
    const opensSection = block.kind === 'heading' || block.kind === 'hr';
    if (opensSection && current.length > 0) {
      sections.push(current);
      current = [];
    }
    current.push(block);
    if (block.kind === 'hr') {
      sections.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    sections.push(current);
  }

  return sections;
};
export type MarkdownDocument = {
  readonly blocks: ReadonlyArray<Block>;
  readonly sections: ReadonlyArray<ReadonlyArray<Block>>;
};

type MarkdownParams = {
  readonly text: string;
};

export const parseMarkdown = ({ text }: MarkdownParams): MarkdownDocument => {
  const blocks = parseBlocks(stripHtml(text));
  return { blocks, sections: toSections(blocks) };
};
