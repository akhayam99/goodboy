// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const ROOT = join(SRC, '..', '..', '..');
const UI_SRC = join(ROOT, 'packages', 'ui', 'src');

const SOURCE = /\.(ts|tsx)$/;
const TEST = /\.test\.(ts|tsx)$/;

const REVEALS = [
  {
    hide: /(?<![\w:/-])opacity-0(?![\w-])/,
    reveal:
      /(?<![\w-])(?:group|peer)-hover(?:\/[\w-]+)?:opacity-100(?![\w-])|(?<![\w:/-])hover:opacity-100(?![\w-])/g,
  },
  {
    hide: /(?<![\w:/-])invisible(?![\w-])/,
    reveal:
      /(?<![\w-])(?:group|peer)-hover(?:\/[\w-]+)?:visible(?![\w-])|(?<![\w:/-])hover:visible(?![\w-])/g,
  },
  {
    hide: /(?<![\w:/-])hidden(?![\w-])/,
    reveal:
      /(?<![\w-])(?:group|peer)-hover(?:\/[\w-]+)?:(?:flex|inline-flex|block|inline|grid)(?![\w-])|(?<![\w:/-])hover:(?:flex|inline-flex|block|inline|grid)(?![\w-])/g,
  },
] as const;

type Allowance = {
  readonly count: number;
  readonly reason: string;
};

const ALLOWED: Readonly<Record<string, Allowance>> = {
  'apps/desktop/src/features/context/components/QuestionsTab/DelegateWaitingRow.tsx': {
    count: 1,
    reason: 'decorative: the aria-hidden chevron inside the row button that opens the delegate',
  },
  'apps/desktop/src/features/chat/components/TranscriptCards/FileEditBlock.tsx': {
    count: 1,
    reason:
      'decorative: the aria-hidden open arrow inside the file edit block, which is the button',
  },
  'apps/desktop/src/features/diff/components/DiffView/LineGutter.tsx': {
    count: 1,
    reason:
      'decorative: the aria-hidden plus over the line number; the line number is the comment button, visible at rest',
  },
  'apps/desktop/src/features/workspace-chat/components/ChatRoom/ChatEmpty.tsx': {
    count: 1,
    reason: 'decorative: the aria-hidden Enter glyph inside a suggestion button',
  },
  'apps/desktop/src/features/history/components/CommitsHistory/HistoryCommitRow.tsx': {
    count: 1,
    reason: 'decorative: the aria-hidden grip of a draggable commit row; the whole row drags',
  },
  'apps/desktop/src/shared/components/ProjectLinkList/ProjectLinkCompactRow.tsx': {
    count: 1,
    reason:
      'decorative: the "Add a description" hint text; the project name button opens the editor',
  },
  'apps/desktop/src/shared/components/SettingChip/index.tsx': {
    count: 1,
    reason:
      'decorative: the aria-hidden chevron inside a setting button, whose label and value show at rest',
  },
  'packages/ui/src/components/ResizeHandle.tsx': {
    count: 1,
    reason: 'decorative: the edge line of a resize handle; the handle itself is always there',
  },
  'packages/ui/src/components/SelectionCheckbox.tsx': {
    count: 1,
    reason:
      'second way: multi select is entered by Cmd or Shift click, and every row keeps its own visible actions',
  },
};

type SourcesParams = {
  readonly dir: string;
};

const sourcesOf = ({ dir }: SourcesParams): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules') {
      return [];
    }
    if (statSync(path).isDirectory()) {
      return sourcesOf({ dir: path });
    }
    return SOURCE.test(name) && !TEST.test(name) ? [path] : [];
  });

type CountParams = {
  readonly text: string;
};

const revealsIn = ({ text }: CountParams): number =>
  REVEALS.reduce(
    (total, { hide, reveal }) =>
      hide.test(text) ? total + (text.match(reveal) ?? []).length : total,
    0,
  );

const found: Readonly<Record<string, number>> = Object.fromEntries(
  [SRC, UI_SRC]
    .flatMap((dir) => sourcesOf({ dir }))
    .map((path) => [relative(ROOT, path), revealsIn({ text: readFileSync(path, 'utf8') })] as const)
    .filter(([, count]) => count > 0),
);

describe('no action shows only on hover (G17)', () => {
  it('reveals nothing on hover outside the decorative list', () => {
    const offenders = Object.entries(found).flatMap(([path, count]) => {
      const allowed = ALLOWED[path]?.count ?? 0;
      return count > allowed ? [`${path}: ${count} hover reveals, allowed ${allowed}`] : [];
    });

    expect(offenders).toEqual([]);
  });

  it('keeps the decorative list exact, so a fixed file leaves it', () => {
    const stale = Object.entries(ALLOWED).flatMap(([path, allowance]) => {
      const count = found[path] ?? 0;
      return count < allowance.count ? [`${path}: allowed ${allowance.count}, found ${count}`] : [];
    });

    expect(stale).toEqual([]);
  });

  it('gives every allowance a reason', () => {
    const missing = Object.entries(ALLOWED).filter(([, allowance]) => allowance.reason === '');

    expect(missing).toEqual([]);
  });
});
