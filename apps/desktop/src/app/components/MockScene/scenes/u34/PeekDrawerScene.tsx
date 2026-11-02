import { useEffect, useState } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import type { GrepMatch } from '../../../../../features/worktree/worktree';
import { useAppStore } from '../../../../../store';
import { DrawerHost } from '../../../DrawerHost';
import { SESSION_ID, seedArtifactScene } from '../artifactSeed';

const WORKTREE = '/mock/payments-api';
const WORD = 'creditKey';
const DRAWER_WIDTH_PX = 720;
const STAGE_HEIGHT_PX = 620;

const PATCH = [
  'diff --git a/src/ledger-core.ts b/src/ledger-core.ts',
  '--- a/src/ledger-core.ts',
  '+++ b/src/ledger-core.ts',
  '@@ -18,3 +18,4 @@',
  ' export const settle = ({ posting }: Params) => {',
  '-  const key = posting.account;',
  '+  const creditKey = `${posting.account}:${posting.currency}`;',
  '+  return ledger.credit({ key: creditKey, amount: posting.amount });',
  ' };',
  '',
].join('\n');

const OLD_TEXT = [
  'export const settle = ({ posting }: Params) => {',
  '  const key = posting.account;',
  '};',
].join('\n');
const NEW_TEXT = [
  'export const settle = ({ posting }: Params) => {',
  '  const creditKey = `${posting.account}:${posting.currency}`;',
  '  return ledger.credit({ key: creditKey, amount: posting.amount });',
  '};',
].join('\n');

const NOTIFY_RELAY_SOURCE = [
  "import { creditKey } from 'ledger-core';",
  '',
  'export const notifyCredit = ({ entry }: Params) => {',
  '  const key = creditKey(entry);',
  '  return relay.send({ key });',
  '};',
].join('\n');

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
    path: 'apps/notify-relay/src/credits.ts',
    line: 4,
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

type Variant = 'changed' | 'unchanged';

const SELECTED = {
  changed: { path: 'src/ledger-core.ts', line: 20 },
  unchanged: { path: 'apps/notify-relay/src/credits.ts', line: 4 },
} as const;

type PrepareParams = { readonly variant: Variant };

const prepare = ({ variant }: PrepareParams): void => {
  mockIPC((command) => {
    if (command === 'worktree_grep_word') {
      return { matches: MATCHES, truncated: false };
    }
    if (command === 'worktree_diff') {
      return PATCH;
    }
    if (command === 'worktree_file_sides') {
      return { old: OLD_TEXT, new: NEW_TEXT, too_large: false };
    }
    if (command === 'explore_read') {
      return { type: 'text', text: NOTIFY_RELAY_SOURCE, truncated: false };
    }
    return null;
  });
  seedArtifactScene({ focusedArtifactId: null });
  useAppStore.getState().openDrawer({
    kind: 'identifier-peek',
    sessionId: SESSION_ID,
    payload: { worktreePath: WORKTREE, word: WORD, selected: SELECTED[variant] },
  });
};

type Props = { readonly variant: Variant };

export const PeekDrawerScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    prepare({ variant });
    setIsReady(true);
  }, [variant]);

  if (!isReady) {
    return null;
  }

  return (
    <div
      data-testid="peek-drawer-stage"
      className="overflow-hidden rounded-lg bg-subtle ring-1 ring-border-soft"
      style={{ width: DRAWER_WIDTH_PX, height: STAGE_HEIGHT_PX }}
    >
      <DrawerHost />
    </div>
  );
};
