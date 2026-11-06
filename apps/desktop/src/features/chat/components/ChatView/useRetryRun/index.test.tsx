// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
  type TurnEvent,
} from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { useRetryRun } from './index';

const SESSION_ID = brandId<SessionId>({ value: 'session-ledger' });
const AGENT_ID = brandId<AgentId>({ value: 'agent-ledger' });
const ASK_RUN = brandId<ProviderRunId>({ value: 'run-ask' });
const FAILED_RUN = brandId<ProviderRunId>({ value: 'run-failed' });
const AT = brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' });

const EVENTS: ReadonlyArray<TurnEvent> = [
  {
    kind: 'permission_request',
    runId: ASK_RUN,
    toolUseId: 'tool-migrate',
    toolName: 'Bash',
    input: { command: 'pnpm db:migrate' },
    at: AT,
  },
  {
    kind: 'permission_decision',
    runId: ASK_RUN,
    toolUseId: 'tool-migrate',
    decision: 'allow',
    scope: 'once',
    ruleId: null,
    decidedBy: 'user',
    at: AT,
  },
  { kind: 'user_text', runId: FAILED_RUN, text: 'Go on.', at: AT },
];

let store: StoryStore;
const sendTurn = vi.fn(async (_input: unknown) => ({ blockedOverBudget: false }));

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  sendTurn.mockClear();
  store.setState({ sendTurn });
});

describe('useRetryRun', () => {
  it('sends the answers the failed turn carried again', async () => {
    const { result } = renderHook(
      () =>
        useRetryRun({
          sessionId: SESSION_ID,
          agentId: AGENT_ID,
          events: EVENTS,
          worktreePath: null,
        }),
      { wrapper: ToastProvider },
    );

    await act(async () => {
      await result.current.retryRun({ runId: FAILED_RUN });
    });

    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Go on.',
        resolvedAsks: {
          denied: [],
          held: [expect.objectContaining({ toolUseId: 'tool-migrate', scope: 'once' })],
        },
      }),
    );
  });
});
