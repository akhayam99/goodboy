import { useEffect, useRef } from 'react';
import type { FileDiff } from '@goodboy/types';
import { DiffView } from '../../../../../features/diff/components/DiffView';
import type { GrepMatch } from '../../../../../features/worktree/worktree';
import { useFakeTauri } from '../brand/fakeTauri';

const FILE: FileDiff = {
  path: 'src/ledger-core.ts',
  status: 'modified',
  additions: 2,
  deletions: 1,
  binary: false,
  hunks: [
    {
      header: '',
      oldStart: 18,
      newStart: 18,
      oldLines: 4,
      newLines: 5,
      lines: [
        {
          kind: 'context',
          oldLine: 18,
          newLine: 18,
          text: 'export const settle = ({ posting }: Params) => {',
        },
        {
          kind: 'del',
          oldLine: 19,
          newLine: null,
          text: '  const key = posting.account;',
        },
        {
          kind: 'add',
          oldLine: null,
          newLine: 19,
          text: '  const creditKey = `${posting.account}:${posting.currency}`;',
        },
        {
          kind: 'add',
          oldLine: null,
          newLine: 20,
          text: '  return ledger.credit({ key: creditKey, amount: posting.amount });',
        },
        { kind: 'context', oldLine: 20, newLine: 21, text: '};' },
      ],
    },
  ],
};

const MATCHES: ReadonlyArray<GrepMatch> = [
  {
    path: 'src/ledger-core.ts',
    line: 19,
    column: 9,
    text: 'const creditKey = `${posting.account}:${posting.currency}`;',
  },
  {
    path: 'src/ledger-core.ts',
    line: 20,
    column: 33,
    text: 'return ledger.credit({ key: creditKey, amount: posting.amount });',
  },
  {
    path: 'src/ledger-core.test.ts',
    line: 12,
    column: 20,
    text: "expect(creditKey({ account: 'acme' })).toBe('acme:EUR');",
  },
  {
    path: 'apps/notify-relay/src/credits.ts',
    line: 41,
    column: 15,
    text: 'const key = creditKey(entry);',
  },
  {
    path: 'apps/payments-api/src/routes/credit.ts',
    line: 8,
    column: 10,
    text: 'import { creditKey } from "ledger-core";',
  },
];

const OPEN_HANDLERS = {
  worktree_grep_word: () => ({ matches: MATCHES, truncated: false }),
};
const EMPTY_HANDLERS = {
  worktree_grep_word: () => ({ matches: [], truncated: false }),
};

const MORE_HANDLERS = {
  worktree_grep_word: () => ({
    matches: [
      ...MATCHES,
      ...Array.from({ length: 8 }, (_, index) => ({
        path: 'apps/payments-api/src/ledger-core/components/notify-relay.tsx',
        line: index + 30,
        column: 8,
        text: 'return creditKey(posting);',
      })),
    ],
    truncated: false,
  }),
};
const LIBRARY_HANDLERS = {
  worktree_grep_word: () => ({
    matches: [
      { path: 'src/ledger-core.tsx', line: 19, column: 7, text: '<Acme maxWidth={448} />' },
      {
        path: 'node_modules/acme/layout.ts',
        line: 1,
        column: 14,
        text: 'export const maxWidth = 448;',
      },
    ],
    truncated: false,
  }),
};
const LIBRARY_FILE: FileDiff = {
  ...FILE,
  hunks: FILE.hunks.map((hunk) => ({
    ...hunk,
    lines: hunk.lines.map((line) =>
      line.newLine === 19 ? { ...line, text: '  return <Acme maxWidth={448} />;' } : line,
    ),
  })),
};

type Props = { readonly state: 'open' | 'empty' | 'more' | 'library' };

export const DiffPeekScene = ({ state }: Props) => {
  const word = state === 'library' ? 'maxWidth' : 'creditKey';
  const handlers =
    state === 'library'
      ? LIBRARY_HANDLERS
      : state === 'more'
        ? MORE_HANDLERS
        : state === 'open'
          ? OPEN_HANDLERS
          : EMPTY_HANDLERS;
  useFakeTauri({ handlers, holdMs: 60_000 });
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (root === null) {
      return;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const at = node.textContent?.indexOf(word) ?? -1;
      if (at < 0 || node.parentElement === null) {
        continue;
      }
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + word.length);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      node.parentElement.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      return;
    }
  }, [word]);

  return (
    <main
      ref={rootRef}
      className="flex min-h-[28rem] min-w-0 flex-col gap-3 bg-background p-6 text-foreground"
    >
      <h1 className="text-title">Payments API changes</h1>
      <DiffView
        files={[state === 'library' ? LIBRARY_FILE : FILE]}
        presentation="inline"
        identifierPeek={{
          worktreePath: '/mock/payments-api',
          onOpenElsewhere: () => undefined,
        }}
      />
    </main>
  );
};
