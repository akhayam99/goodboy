// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const ROOTS = [
  join(__dirname, '..', '..'),
  join(__dirname, '..', '..', '..', '..', '..', 'packages', 'ui', 'src'),
];

const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist']);

const listComponentFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listComponentFiles(full, acc);
      continue;
    }
    if (entry.endsWith('.tsx') && !entry.includes('.test.')) {
      acc.push(full);
    }
  }
  return acc;
};

const openTagEnd = ({ source, from }: { source: string; from: number }): number => {
  let depth = 0;
  for (let i = from; i < source.length; i++) {
    const char = source[i];
    if (char === '{') {
      depth++;
      continue;
    }
    if (char === '}') {
      depth--;
      continue;
    }
    if (char === '>' && depth === 0) {
      return i;
    }
  }
  return -1;
};

const CONTROL_TAGS = ['button', 'a', 'Button'] as const;

type ControlTag = (typeof CONTROL_TAGS)[number];

const nextOpenOf = ({ source, tag, from }: { source: string; tag: ControlTag; from: number }) => {
  const opener = new RegExp(`<${tag}\\b`, 'g');
  opener.lastIndex = from;
  return opener.exec(source)?.index ?? -1;
};

const closeTagEnd = ({
  source,
  from,
  tag,
}: {
  source: string;
  from: number;
  tag: ControlTag;
}): number => {
  const closer = `</${tag}>`;
  let cursor = from + 1;
  let nested = 0;
  while (cursor < source.length) {
    const nextOpen = nextOpenOf({ source, tag, from: cursor });
    const nextClose = source.indexOf(closer, cursor);
    if (nextClose === -1) {
      return -1;
    }
    if (nextOpen !== -1 && nextOpen < nextClose) {
      nested++;
      cursor = nextOpen + tag.length + 1;
      continue;
    }
    if (nested === 0) {
      return nextClose + closer.length;
    }
    nested--;
    cursor = nextClose + closer.length;
  }
  return -1;
};

const PLACEHOLDER = '\u0000';

const childExpressions = ({ body }: { body: string }): string[] => {
  const found: string[] = [];
  let cursor = 0;
  let tagDepth = 0;
  while (cursor < body.length) {
    const char = body[cursor];
    if (char === '<') {
      tagDepth++;
      cursor++;
      continue;
    }
    if (char === '>' && tagDepth > 0) {
      tagDepth--;
      cursor++;
      continue;
    }
    if (char !== '{' || tagDepth > 0) {
      cursor++;
      continue;
    }
    let braces = 0;
    let end = cursor;
    while (end < body.length) {
      const inner = body[end];
      braces += inner === '{' ? 1 : inner === '}' ? -1 : 0;
      if (braces === 0) {
        break;
      }
      end++;
    }
    found.push(body.slice(cursor, end + 1));
    cursor = end + 1;
  }
  return found;
};

const rendersOwnText = ({ body }: { body: string }): boolean => {
  const literalText = body
    .replace(/<[^>]*>/g, PLACEHOLDER)
    .replace(/\{[^]*?\}/g, PLACEHOLDER)
    .split(PLACEHOLDER)
    .map((chunk) => chunk.trim())
    .some((chunk) => chunk.length > 0 && !/^[{}()/]+$/.test(chunk));
  if (literalText) {
    return true;
  }
  const interpolationsResolvingToText = childExpressions({ body }).filter(
    (expression) => !expression.includes('<'),
  );
  return interpolationsResolvingToText.length > 0;
};

const rendersAnIcon = ({ body }: { body: string }): boolean =>
  /<[A-Z][\w.]*\s[^>]*(size=|aria-hidden)/.test(body);

const NO_TOOLTIP = -1;

const elementsUpToTooltip = ({ source, from }: { source: string; from: number }): number => {
  let cursor = from - 1;
  for (let hop = 0; hop < 3; hop++) {
    while (cursor >= 0 && /\s/.test(source.charAt(cursor))) {
      cursor--;
    }
    if (source.charAt(cursor) !== '>') {
      return NO_TOOLTIP;
    }
    const start = source.lastIndexOf('<', cursor);
    if (/^<Tooltip\b/.test(source.slice(start, cursor + 1))) {
      return hop;
    }
    cursor = start - 1;
  }
  return NO_TOOLTIP;
};

type Offender = { location: string; reason: string };

type Audit = { offenders: Offender[]; inspected: number };

const auditSource = ({ source, label }: { source: string; label: string }): Audit => {
  const offenders: Offender[] = [];
  let inspected = 0;
  for (const tag of CONTROL_TAGS) {
    const closer = `</${tag}>`;
    const controls = new RegExp(`<${tag}\\b`, 'g');
    let match = controls.exec(source);
    while (match !== null) {
      const start = match.index;
      const tagEnd = openTagEnd({ source, from: start });
      match = controls.exec(source);
      if (tagEnd === -1) {
        continue;
      }
      const openTag = source.slice(start, tagEnd + 1);
      if (!/aria-label/.test(openTag)) {
        continue;
      }
      const selfClosing = openTag.trimEnd().endsWith('/>');
      const end = selfClosing ? tagEnd + 1 : closeTagEnd({ source, from: tagEnd, tag });
      if (end === -1) {
        continue;
      }
      const body = selfClosing ? '' : source.slice(tagEnd + 1, end - closer.length);
      if (rendersOwnText({ body }) || !rendersAnIcon({ body })) {
        continue;
      }
      inspected++;
      const line = source.slice(0, start).split('\n').length;
      const location = `${label}:${line}`;
      const canBeDisabled = /\sdisabled(?:=|\s|$)/.test(openTag);
      if (/\stitle=/.test(openTag)) {
        offenders.push({ location, reason: 'carries a native title' });
        continue;
      }
      const hops = elementsUpToTooltip({ source, from: start });
      if (hops === NO_TOOLTIP) {
        offenders.push({ location, reason: 'has no Tooltip' });
        continue;
      }
      if (canBeDisabled && hops > 0) {
        offenders.push({
          location,
          reason: 'can go disabled behind a wrapper, where Tooltip cannot anchor it',
        });
      }
    }
  }
  return { offenders, inspected };
};

const auditFile = ({ file, root }: { file: string; root: string }): Audit =>
  auditSource({ source: readFileSync(file, 'utf8'), label: relative(root, file) });

const auditEverything = (): Audit => {
  const offenders: Offender[] = [];
  let inspected = 0;
  for (const root of ROOTS) {
    for (const file of listComponentFiles(root)) {
      const audit = auditFile({ file, root });
      offenders.push(...audit.offenders);
      inspected += audit.inspected;
    }
  }
  return { offenders, inspected };
};

const FLOOR = 50;

describe('an icon-only control', () => {
  it('says what it does through the shared Tooltip, never a native title', () => {
    const offenders = auditEverything().offenders.map(
      (offender) => `${offender.location} ${offender.reason}`,
    );

    expect(
      offenders,
      [
        'A control whose only content is an icon needs a tooltip: the aria-label',
        'names it for assistive tech, and nothing at all names it for the pointer.',
        'The native title waits a second and renders in the OS chrome, so wrap the',
        'control in the shared Tooltip instead. A control that can go disabled is',
        'the direct child of its Tooltip, never wrapped in a hand-rolled span: the',
        'primitive reads disabled off its child to anchor the listeners somewhere',
        'the pointer can still reach. Shape that anchor with anchorClassName.',
        'Offenders:',
        offenders.join('\n'),
      ].join('\n'),
    ).toEqual([]);
  });

  it('is still being found, so the sweep above cannot pass by seeing nothing', () => {
    expect(auditEverything().inspected).toBeGreaterThanOrEqual(FLOOR);
  });
});

describe('the audit itself', () => {
  const reasonsFor = (source: string): string[] =>
    auditSource({ source, label: 'fixture' }).offenders.map((offender) => offender.reason);

  it('reports an icon-only button whose icon is a member expression', () => {
    const source = '<button aria-label="x"><CONCEPT_ICONS.agents size={12} /></button>';

    expect(reasonsFor(source)).toEqual(['has no Tooltip']);
  });

  it('reports an icon-only anchor with no tooltip', () => {
    const source = '<a aria-label="x" href="/x"><ExternalLink size={12} /></a>';

    expect(reasonsFor(source)).toEqual(['has no Tooltip']);
  });

  it('reports an icon-only Button with no tooltip', () => {
    const source = '<Button aria-label="x"><CONCEPT_ICONS.agents size={12} /></Button>';

    expect(reasonsFor(source)).toEqual(['has no Tooltip']);
  });

  it('reports a native title on each form', () => {
    const source = [
      '<button aria-label="x" title="x"><Icon size={12} /></button>',
      '<a aria-label="x" title="x"><Icon size={12} /></a>',
      '<Button aria-label="x" title="x"><Icon size={12} /></Button>',
    ].join('\n');

    expect(reasonsFor(source)).toEqual([
      'carries a native title',
      'carries a native title',
      'carries a native title',
    ]);
  });

  it('accepts each form inside a Tooltip', () => {
    const source = [
      '<Tooltip content="x"><button aria-label="x"><CONCEPT_ICONS.agents size={12} /></button></Tooltip>',
      '<Tooltip content="x"><a aria-label="x" href="/x"><Icon size={12} /></a></Tooltip>',
      '<Tooltip content="x"><Button aria-label="x"><Icon size={12} /></Button></Tooltip>',
    ].join('\n');

    expect(reasonsFor(source)).toEqual([]);
  });

  it('leaves a control that carries its own text alone', () => {
    const source = '<Button aria-label="x"><Icon size={12} />Open</Button>';

    expect(auditSource({ source, label: 'fixture' })).toEqual({ offenders: [], inspected: 0 });
  });
});
