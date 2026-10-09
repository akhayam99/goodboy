// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules']);
const HAND_ROLLED_INLINE = /size="inline"/;
const WRAPPERS: ReadonlySet<string> = new Set([
  'EmptyLine',
  'EmptyState',
  'FilledEmptyState',
  'Notice',
]);

const ALLOWED: Readonly<Record<string, number>> = {
  'features/history/components/CommitsHistory/HistoryPlannedChanges.tsx': 1,
  'features/history/components/CommitsHistory/HistoryResult.tsx': 2,
  'features/session/components/SessionKickoff/TaskStart.tsx': 1,
  'features/settings/components/SettingsStudio/WorkspaceSettingsFlow.tsx': 1,
};

const listSourceFiles = ({ dir }: { readonly dir: string }): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((entry) => {
    if (SKIP_SEGMENTS.has(entry)) {
      return [];
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return listSourceFiles({ dir: full });
    }
    if (!entry.endsWith('.tsx') || entry.endsWith('.test.tsx')) {
      return [];
    }
    return [full];
  });

type TextParams = {
  readonly text: string;
};

type NodeParams = { readonly node: ts.Node };

const isWrapped = ({ node }: NodeParams): boolean => {
  const parent = node.parent;
  if (parent === undefined) {
    return false;
  }
  if (ts.isJsxElement(parent) && WRAPPERS.has(parent.openingElement.tagName.getText())) {
    return true;
  }
  return isWrapped({ node: parent });
};

const countHandWrittenNone = ({ text }: TextParams): number => {
  const source = ts.createSourceFile(
    'empty.tsx',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let count = 0;
  const visit = ({ node }: NodeParams): void => {
    if (
      ts.isJsxText(node) &&
      /^(?:No\s|Nothing\b|None\b)/.test(node.text.trim()) &&
      !isWrapped({ node })
    ) {
      count += 1;
    }
    ts.forEachChild(node, (child) => visit({ node: child }));
  };
  visit({ node: source });
  return count;
};

const toPath = (full: string): string => relative(SRC, full).split(sep).join('/');

const measure = (): Record<string, number> =>
  Object.fromEntries(
    listSourceFiles({ dir: SRC })
      .map(
        (file) =>
          [toPath(file), countHandWrittenNone({ text: readFileSync(file, 'utf8') })] as const,
      )
      .filter(([, count]) => count > 0),
  );

describe('inline empty states', () => {
  it('use EmptyState page or section, never the retired inline size', () => {
    const offenders = listSourceFiles({ dir: SRC })
      .filter((file) => HAND_ROLLED_INLINE.test(readFileSync(file, 'utf8')))
      .map(toPath);

    expect(offenders).toEqual([]);
  });
});

describe('an empty line is written through a wrapper', () => {
  it('counts text that opens with No, Nothing or None outside EmptyLine and the empty states', () => {
    expect(countHandWrittenNone({ text: '<p className="text-meta">No notes.</p>' })).toBe(1);
    expect(countHandWrittenNone({ text: '<span>\n  Nothing to show\n</span>' })).toBe(1);
    expect(countHandWrittenNone({ text: '<li onClick={() => open()}>None</li>' })).toBe(1);
    expect(countHandWrittenNone({ text: '<EmptyLine>No notes on this screen.</EmptyLine>' })).toBe(
      0,
    );
    expect(countHandWrittenNone({ text: '<p>Notes are saved.</p>' })).toBe(0);
    expect(countHandWrittenNone({ text: '<EmptyState title="No notes" />' })).toBe(0);
  });

  it('adds no hand-written empty sentence to any file beyond its allowance', () => {
    const counts = measure();
    const grown = Object.entries(counts)
      .filter(([path, count]) => count > (ALLOWED[path] ?? 0))
      .map(([path, count]) => `${path}: ${count} (allowed ${ALLOWED[path] ?? 0})`);

    expect(
      grown,
      `Write an empty line with EmptyLine, a first-time state with EmptyState (DESIGN-SYSTEM.md, Empty states):\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});
