// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProviderRunId } from '@goodboy/types';
import { TEST_NOW, nextAgentId, nextProviderRunId, nextSessionId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { TranscriptItem } from '../../utils/transcript-items';
import type { ConversationRow } from '../../utils/conversationRows';
import { liveTextRegistry } from '../../reveal/liveTextRegistry';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../features/chat/turn', async () => {
  const actual = await vi.importActual<typeof import('../../turn')>('../../turn');
  return {
    ...(await import('../../../../store/storyHarness')).turnModuleMock(),
    encodeAuthRequiredMessage: actual.encodeAuthRequiredMessage,
    decodeAuthRequiredMessage: actual.decodeAuthRequiredMessage,
  };
});
vi.mock('../../../../features/permissions/permissions', async () =>
  (await import('../../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../../features/providers/providers', async () =>
  (await import('../../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../../../features/providers/routing', async () =>
  (await import('../../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../../../features/budget/budget', async () =>
  (await import('../../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../../../features/skills/skills', async () =>
  (await import('../../../../store/storyHarness')).skillsModuleMock(),
);
vi.mock('../../../../features/workflows/workflows', async () =>
  (await import('../../../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../../features/worktree/worktree', async () =>
  (await import('../../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../../shared/lib/repo', async () =>
  (await import('../../../../store/storyHarness')).repoModuleMock(),
);
vi.mock('../../../../features/plans/plans', async () =>
  (await import('../../../../store/storyHarness')).plansModuleMock(),
);

import { ToastProvider } from '../../../../shared/components/Toast';
import { TranscriptRows } from './TranscriptRows';

const SESSION = nextSessionId();
const AGENT = nextAgentId();
const AT = TEST_NOW;
const VERDICT_TEXT =
  'Checked it.\n<<comment-wontfix threadId="PRRT_ledger1" reason="already covered upstream">>';

let useAppStore: StoryStore;

const textRow = ({
  key,
  text,
  runId,
}: {
  readonly key: string;
  readonly text: string;
  readonly runId: ProviderRunId;
}): ConversationRow => {
  const item: TranscriptItem = { kind: 'assistant_text', key, text, runId };
  return { kind: 'item', key, item };
};

const userRow = (): ConversationRow => ({
  kind: 'item',
  key: 'user-1',
  item: { kind: 'user_text', key: 'user-1', text: 'review payments-api', at: AT },
});

const rowsOf = ({
  runId,
  texts,
}: {
  readonly runId: ProviderRunId;
  readonly texts: ReadonlyArray<string>;
}): ReadonlyArray<ConversationRow> => [
  userRow(),
  ...texts.map((text, index) => textRow({ key: `text-${index}`, text, runId })),
];

const tree = ({ rows }: { readonly rows: ReadonlyArray<ConversationRow> }) => (
  <ToastProvider>
    <ul>
      <TranscriptRows
        rows={rows}
        oqByTurnOrdinal={new Map()}
        sessionId={SESSION}
        selectedAgentId={AGENT}
        workingDir={null}
        onRefreshAuth={() => undefined}
        onOpenDiff={() => undefined}
        isThinking={false}
        thinkingPhrase="Thinking"
        onRetryRun={() => undefined}
        retryingRunId={null}
        activeRunId={null}
      />
    </ul>
  </ToastProvider>
);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  liveTextRegistry.clear();
  useAppStore.setState({ viewFind: null });
});

afterEach(cleanup);

describe('TranscriptRows reading order', () => {
  it('keeps the chips of a marker in earlier narration and folds only the plain notes', () => {
    const runId = nextProviderRunId();
    render(
      tree({
        rows: rowsOf({
          runId,
          texts: ['Reading notify-relay', VERDICT_TEXT, 'Northwind needs no change.'],
        }),
      }),
    );
    screen.getByText('already covered upstream');
    expect(screen.getAllByTestId('reading-notes')).toHaveLength(1);
    screen.getByRole('button', { name: 'Notes, 1 line' });
  });

  it('keeps Notes open when the row re-renders with the same key and a new message', () => {
    const runId = nextProviderRunId();
    const texts = ['Reading notify-relay', 'Northwind needs no change.'];
    const { rerender } = render(tree({ rows: rowsOf({ runId, texts }) }));
    const trigger = screen.getByRole('button', { name: 'Notes, 1 line' });
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const followUp: ReadonlyArray<ConversationRow> = [
      {
        kind: 'item',
        key: 'user-2',
        item: { kind: 'user_text', key: 'user-2', text: 'and Acme?', at: AT },
      },
      textRow({ key: 'text-next', text: 'Acme confirmed.', runId }),
    ];
    rerender(tree({ rows: [...rowsOf({ runId, texts }), ...followUp] }));
    expect(
      screen.getByRole('button', { name: 'Notes, 1 line' }).getAttribute('aria-expanded'),
    ).toBe('true');
    screen.getByText('Reading notify-relay');
  });
});
