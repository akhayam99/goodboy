// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';

const setAgentProviderSession = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../storyHarness')).dbModuleMock({ setAgentProviderSession }),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../storyHarness')).dbLibModuleMock(),
);

import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryAgent,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../storyHarness';
import { leadDeliveryMemory, type SessionInitEvent } from './leadDeliveryMemory';
import { settleLeadTurn } from './settleLeadTurn';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const LEAD = brandId<AgentId>({ value: 'agent-lead-harborline' });
const RUN = 'run-fresh-1';

const INIT: SessionInitEvent = {
  kind: 'provider_session_init',
  runId: brandId<ProviderRunId>({ value: RUN }),
  providerSessionId: 'claude-session-new',
  provider: 'anthropic',
  at: brandId<IsoDateTime>({ value: '2026-11-26T10:00:00.000Z' }),
};

let useAppStore: StoryStore;

const leadSessionId = (): string | undefined =>
  useAppStore.getState().sessionPhaseRuns[SESSION_ID]?.find((run) => run.id === LEAD)
    ?.providerSessionId;

type SettleParams = {
  readonly hasSucceeded: boolean;
};

const settle = ({ hasSucceeded }: SettleParams) =>
  settleLeadTurn({
    set: useAppStore.setState,
    get: useAppStore.getState,
    sessionId: SESSION_ID,
    agentId: LEAD,
    runId: RUN,
    hasSucceeded,
    providerSessionId: INIT.providerSessionId,
  });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  leadDeliveryMemory.clear();
  setAgentProviderSession.mockReset();
  setAgentProviderSession.mockResolvedValue(undefined);
  useAppStore.setState({
    sessionPhaseRuns: {
      [SESSION_ID]: [
        buildStoryAgent({
          id: LEAD,
          sessionId: SESSION_ID,
          providerSessionId: 'claude-session-old',
          providerSessionProviderId: 'anthropic',
        }),
      ],
    },
  });
  leadDeliveryMemory.begin({ agentId: LEAD, runId: RUN, sent: new Map(), isFresh: true });
  leadDeliveryMemory.hold({ agentId: LEAD, runId: RUN, event: INIT });
});

describe('the session of a Lead that started fresh', () => {
  it('is kept once the turn succeeded', async () => {
    await settle({ hasSucceeded: true });

    expect(leadSessionId()).toBe('claude-session-new');
    expect(setAgentProviderSession).toHaveBeenCalledWith(expect.anything(), {
      id: LEAD,
      providerSessionId: 'claude-session-new',
      providerSessionProviderId: 'anthropic',
    });
    expect(leadDeliveryMemory.baselineOf({ agentId: LEAD })?.sessionId).toBe('claude-session-new');
  });

  it('leaves the old session when the turn failed', async () => {
    await settle({ hasSucceeded: false });

    expect(leadSessionId()).toBe('claude-session-old');
    expect(setAgentProviderSession).not.toHaveBeenCalled();
    expect(leadDeliveryMemory.baselineOf({ agentId: LEAD })).toBeNull();
  });

  it('leaves the old session and says so when saving the new one fails', async () => {
    setAgentProviderSession.mockRejectedValue(new Error('database is locked'));

    await settle({ hasSucceeded: true });

    expect(leadSessionId()).toBe('claude-session-old');
    expect(useAppStore.getState().notifications.map((notice) => notice.title)).toContain(
      "Couldn't keep the Lead's new session",
    );
  });
});
