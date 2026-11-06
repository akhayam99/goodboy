// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type TurnState,
} from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { AgentDockNext } from './index';

const AGENT_ID = brandId<AgentId>({ value: 'agent-harborline' });
const RUN = brandId<ProviderRunId>({ value: 'run-1' });
const AT = brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' });
const BLOCKED: TurnState = { kind: 'blocked', runId: RUN, blockedAt: AT };
const IDLE: TurnState = { kind: 'idle', lastActivityAt: AT };

const SESSION = aSession({});
const AGENT = anAgent({ id: AGENT_ID, sessionId: SESSION.id });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 } });
});

afterEach(cleanup);

describe('AgentDockNext', () => {
  it('reads the session once, however many asks open and settle on this conversation', () => {
    const loadSessionEvents = vi.fn(async () => undefined);
    useAppStore.setState({
      loadSessionEvents,
      sessionPhaseRuns: { [SESSION.id]: [AGENT] },
      agentTurnState: { [AGENT_ID]: IDLE },
      transcripts: {
        [AGENT_ID]: [
          {
            kind: 'permission_request',
            runId: RUN,
            toolUseId: 'tool-1',
            toolName: 'Read',
            input: {},
            at: AT,
          },
        ],
      },
    });
    render(
      <ToastProvider>
        <AgentDockNext session={SESSION} agent={AGENT} />
      </ToastProvider>,
    );
    expect(loadSessionEvents).toHaveBeenCalledTimes(1);

    act(() => {
      useAppStore.setState({ agentTurnState: { [AGENT_ID]: BLOCKED } });
    });
    act(() => {
      useAppStore.setState({ agentTurnState: { [AGENT_ID]: IDLE } });
    });
    act(() => {
      useAppStore.setState({ agentTurnState: { [AGENT_ID]: BLOCKED } });
    });
    act(() => {
      useAppStore.setState({ agentTurnState: { [AGENT_ID]: IDLE } });
    });

    expect(loadSessionEvents).toHaveBeenCalledTimes(1);
  });
});
