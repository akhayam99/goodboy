import { ROW_ACTION_LABEL } from '../../features/workTreeModel/rowActionLabels';
import { describe, expect, it } from 'vitest';
import { copySourcePaths, describeCopy, readCopySource, scanCopy } from './scanCopy';
import { scanCopySource, type CopyString } from './scanCopySource';

const RETIRED =
  /^(?:Open full|View|See|View transcript|Go to chat|See what it did|Open agent chat|See diff(?: of)?)$/;
const ACTION_PROPS: ReadonlySet<string> = new Set([
  'label',
  'actionLabel',
  'confirmLabel',
  'shortLabel',
  'short',
  'aria-label',
  'ariaLabel',
]);
const CONTROLS: ReadonlySet<string> = new Set([
  'button',
  'Button',
  'GhostActionButton',
  'IconButton',
  'MenuItem',
  'MenuRow',
  'Chip',
]);
const CONTROL_CHILD =
  />\s*\{(\w+)\.(\w+)\}\s*<\/(?:button|Button|GhostActionButton|IconButton|MenuItem|MenuRow|Chip)>/g;
const ACTION_ATTRIBUTE =
  /\b(?:label|actionLabel|confirmLabel|shortLabel|aria-label|ariaLabel)=\{`?(?:\$\{)?(\w+)\.(\w+)\}/g;

type Params = {
  readonly copy: CopyString;
};

type TextParams = {
  readonly text: string;
};

type ReadParams = {
  readonly path: string;
};

type ReferencedParams = {
  readonly paths: ReadonlyArray<string>;
  readonly read: (params: ReadParams) => string;
};

type ResolveParams = {
  readonly from: string;
  readonly table: string;
  readonly text: string;
  readonly paths: ReadonlySet<string>;
};

const isRetiredVerb = ({ copy }: Params): boolean => {
  if (!RETIRED.test(copy.text) || copy.element === 'FacetSection') {
    return false;
  }
  return (
    (copy.prop !== null && ACTION_PROPS.has(copy.prop)) ||
    (copy.prop === null && copy.element !== undefined && CONTROLS.has(copy.element))
  );
};

const resolveTable = ({ from, table, text, paths }: ResolveParams): string | undefined => {
  const imported = new RegExp(`import\\s*\\{[^}]*\\b${table}\\b[^}]*\\}\\s*from\\s*'([^']+)'`).exec(
    text,
  );
  const specifier = imported?.[1];
  if (specifier === undefined || !specifier.startsWith('.')) {
    return undefined;
  }
  const parts = from.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '..') {
      parts.pop();
    } else if (part !== '.') {
      parts.push(part);
    }
  }
  const base = parts.join('/');
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((path) =>
    paths.has(path),
  );
};

const referencesIn = ({ text }: TextParams): ReadonlyArray<[string, string]> =>
  [...text.matchAll(CONTROL_CHILD), ...text.matchAll(ACTION_ATTRIBUTE)].map(
    (match): [string, string] => [match[1] ?? '', match[2] ?? ''],
  );

const referencedLabels = ({ paths, read }: ReferencedParams): ReadonlyArray<CopyString> => {
  const known = new Set(paths);
  const found: Array<CopyString> = [];
  for (const path of paths) {
    const text = read({ path });
    for (const [table, key] of referencesIn({ text })) {
      const target = resolveTable({ from: path, table, text, paths: known });
      if (target === undefined) {
        continue;
      }
      const literal = new RegExp(`\\b${key}:\\s*(?:'([^']*)'|"([^"]*)")`).exec(
        read({ path: target }),
      );
      const value = literal?.[1] ?? literal?.[2];
      if (value !== undefined) {
        found.push({ path: target, line: 1, prop: key, text: value });
      }
    }
  }
  return found;
};

describe('one verb per move or act', () => {
  it.each(['View transcript', 'See what it did', 'Go to chat', 'Open full', 'View'])(
    'rejects %s on a control',
    (label) => {
      const copies = scanCopySource({ path: 'Harborline.tsx', text: `<Button>${label}</Button>` });
      expect(copies.some((copy) => isRetiredVerb({ copy }))).toBe(true);
    },
  );

  it('keeps a view noun on a facet heading and advice in a sentence', () => {
    const copies = scanCopySource({
      path: 'Harborline.tsx',
      text: `<FacetSection label="View" /><p>See the branch before you retry.</p>`,
    });

    expect(copies.filter((copy) => isRetiredVerb({ copy }))).toEqual([]);
  });

  it('keeps the shared row actions on the same verbs', () => {
    expect(Object.values(ROW_ACTION_LABEL).filter((label) => RETIRED.test(label))).toEqual([]);
  });

  it('finds no retired moving verb on a control', () => {
    const offenders = scanCopy()
      .filter((copy) => isRetiredVerb({ copy }))
      .map((copy) => describeCopy({ copy }));

    expect(offenders).toEqual([]);
  });

  it('reads a label that a control takes from a copy table', () => {
    const files: Record<string, string> = {
      'features/Harborline/Queue.tsx': [
        `import { QUEUE_COPY } from './queueCopy';`,
        `import { FIX_COPY } from './fixCopy';`,
        `export const Queue = () => (`,
        `  <><Button>{QUEUE_COPY.view}</Button><Button aria-label={\`\${FIX_COPY.seeDiffOf} 90b1d57\`}>{FIX_COPY.seeDiff}</Button></>`,
        `);`,
      ].join('\n'),
      'features/Harborline/queueCopy.ts': `export const QUEUE_COPY = { view: 'View' } as const;`,
      'features/Harborline/fixCopy.ts': `export const FIX_COPY = { seeDiff: 'See diff', seeDiffOf: 'See diff of' } as const;`,
    };

    const labels = referencedLabels({
      paths: Object.keys(files),
      read: ({ path }) => files[path] ?? '',
    }).map((copy) => copy.text);

    expect(labels).toEqual(expect.arrayContaining(['View', 'See diff', 'See diff of']));
    expect(labels.filter((label) => RETIRED.test(label))).toEqual([
      'View',
      'See diff',
      'See diff of',
    ]);
  });

  it('finds no retired moving verb in a copy table that a control renders', () => {
    const offenders = referencedLabels({
      paths: copySourcePaths(),
      read: readCopySource,
    })
      .filter((copy) => RETIRED.test(copy.text))
      .map((copy) => describeCopy({ copy }));

    expect(offenders).toEqual([]);
  });
});
