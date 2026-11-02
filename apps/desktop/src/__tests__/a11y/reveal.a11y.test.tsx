// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import type { ProviderRunId } from '@goodboy/types';
import { nextAgentId, nextProviderRunId, nextSessionId } from '@goodboy/types/testing';
import { STORE_IMPORT_TIMEOUT_MS, importStore } from '../../store/storyHarness';
import { ToastProvider } from '../../shared/components/Toast';
import type { ConversationRow } from '../../features/chat/utils/conversationRows';
import { liveTextRegistry } from '../../features/chat/reveal/liveTextRegistry';
import { revealPacer } from '../../features/chat/reveal/revealPacer';
import { runA11yCheck } from './utils';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../features/chat/turn', async () => {
  const actual = await vi.importActual<typeof import('../../features/chat/turn')>(
    '../../features/chat/turn',
  );
  return {
    ...(await import('../../store/storyHarness')).turnModuleMock(),
    encodeAuthRequiredMessage: actual.encodeAuthRequiredMessage,
    decodeAuthRequiredMessage: actual.decodeAuthRequiredMessage,
  };
});
vi.mock('../../features/permissions/permissions', async () =>
  (await import('../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../features/providers/providers', async () =>
  (await import('../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../features/providers/routing', async () =>
  (await import('../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../features/budget/budget', async () =>
  (await import('../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../features/workflows/workflows', async () =>
  (await import('../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../features/worktree/worktree', async () =>
  (await import('../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../shared/lib/repo', async () =>
  (await import('../../store/storyHarness')).repoModuleMock(),
);
vi.mock('../../features/plans/plans', async () =>
  (await import('../../store/storyHarness')).plansModuleMock(),
);

import { TranscriptRows } from '../../features/chat/components/ChatView/TranscriptRows';

const SESSION = nextSessionId();
const AGENT = nextAgentId();
const ANSWER = Array.from(
  { length: 30 },
  (_, index) => `Northwind step ${index} keeps ledger-core steady.`,
).join(' ');

const answerRow = ({ runId }: { readonly runId: ProviderRunId }): ConversationRow => ({
  kind: 'item',
  key: 'text-2',
  item: { kind: 'assistant_text', key: 'text-2', text: ANSWER, runId },
});

const renderAnswer = ({ runId }: { readonly runId: ProviderRunId }) =>
  render(
    <ToastProvider>
      <main>
        <ul aria-live="polite" aria-relevant="additions" aria-label="Conversation">
          <TranscriptRows
            rows={[answerRow({ runId })]}
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
      </main>
    </ToastProvider>,
  );

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(() => {
  liveTextRegistry.clear();
  revealPacer.reset();
});

afterEach(() => {
  cleanup();
  revealPacer.reset();
});

describe('text reveal accessibility', () => {
  it('holds the row busy while it writes in, with no violations, and releases it at the end', async () => {
    const runId = nextProviderRunId();
    liveTextRegistry.mark({ runId });
    const { container } = renderAnswer({ runId });

    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
    const during = await runA11yCheck(container);
    expect(during.violations).toEqual([]);

    act(() => {
      revealPacer.flushRun({ runId });
    });

    expect(container.querySelector('[aria-busy]')).toBeNull();
    expect(container.textContent).toContain('Northwind step 29 keeps ledger-core steady.');
    const after = await runA11yCheck(container);
    expect(after.violations).toEqual([]);
  });

  it('never leaves a busy flag behind when the reveal is finished early', () => {
    const runId = nextProviderRunId();
    liveTextRegistry.mark({ runId });
    const { container } = renderAnswer({ runId });

    act(() => {
      revealPacer.flushRun({ runId });
    });

    expect(container.querySelector('[aria-busy]')).toBeNull();
    expect(container.textContent).toContain('Northwind step 29 keeps ledger-core steady.');
  });

  it('never marks text that is shown whole as busy', () => {
    const runId = nextProviderRunId();
    const { container } = renderAnswer({ runId });

    expect(container.querySelector('[aria-busy]')).toBeNull();
  });
});
