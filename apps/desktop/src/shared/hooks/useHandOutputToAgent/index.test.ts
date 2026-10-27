// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import {
  nextAgentId,
  nextProviderRunId,
  nextSessionId,
  nextWorkspaceId,
} from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  buildStoryAgent,
  buildStorySession,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../store/storyHarness';
import { useHandOutputToAgent } from '.';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

type StoreState = ReturnType<StoryStore['getState']>;

const WORKSPACE_ID = nextWorkspaceId();
const SESSION_ID = nextSessionId();
const OTHER_SESSION_ID = nextSessionId();
const GONE_SESSION_ID = nextSessionId();
const IMPLEMENTER = nextAgentId();
const REVIEWER = nextAgentId();
const OTHER_AGENT = nextAgentId();
const OUTPUT = {
  subject: 'Check posting drift',
  outcome: 'Exit 1',
  projectName: 'ledger-core',
  branch: 'nw/fix-settlement-replay',
  output: 'FAIL postings/rounding.test.ts\nExit 1',
} as const;

let useAppStore: StoryStore;
let restore: Partial<StoreState> = {};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [
      buildStorySession({
        id: SESSION_ID,
        workspaceId: WORKSPACE_ID,
        goal: 'Fix settlement replay',
      }),
      buildStorySession({
        id: OTHER_SESSION_ID,
        workspaceId: WORKSPACE_ID,
        goal: 'Refund webhook',
      }),
    ],
    currentSessionId: SESSION_ID,
    sessionPhaseRuns: {
      [SESSION_ID]: [
        buildStoryAgent({ id: IMPLEMENTER, sessionId: SESSION_ID, name: 'Implementer' }),
        buildStoryAgent({ id: REVIEWER, sessionId: SESSION_ID, name: 'Reviewer' }),
      ],
      [OTHER_SESSION_ID]: [buildStoryAgent({ id: OTHER_AGENT, sessionId: OTHER_SESSION_ID })],
    },
    selectedAgentId: { [SESSION_ID]: REVIEWER },
  });
});

afterEach(() => {
  cleanup();
  useAppStore.setState(restore);
  restore = {};
});

describe('useHandOutputToAgent', () => {
  it('queues the output for the agent on screen and sends nothing', () => {
    const { result } = renderHook(() => useHandOutputToAgent({ sessionId: SESSION_ID }));

    expect(result.current.canHandOff).toBe(true);
    expect(result.current.askLabel).toBe('Ask the agent about this');
    result.current.handOff(OUTPUT);

    const queued = useAppStore.getState().outputHandoffs[REVIEWER];
    expect(queued).toHaveLength(1);
    expect(queued?.[0]?.title).toBe(
      'Output of Check posting drift, Exit 1, ledger-core on nw/fix-settlement-replay',
    );
    expect(queued?.[0]?.text).toContain('FAIL postings/rounding.test.ts');
    expect(useAppStore.getState().outputHandoffs[IMPLEMENTER]).toBeUndefined();
    expect(useAppStore.getState().agentDraft[REVIEWER]).toBeUndefined();
    expect(storySpies.tauriInvoke).not.toHaveBeenCalled();
  });

  it('hands the output to the agent while it is still running', () => {
    useAppStore.setState({
      agentTurnState: {
        [REVIEWER]: { kind: 'running', runId: nextProviderRunId(), startedAt: STORY_NOW },
      },
    });
    const { result } = renderHook(() => useHandOutputToAgent({ sessionId: SESSION_ID }));

    result.current.handOff(OUTPUT);

    expect(useAppStore.getState().outputHandoffs[REVIEWER]).toHaveLength(1);
    expect(storySpies.tauriInvoke).not.toHaveBeenCalled();
  });

  it('hides the verb in an archived session and does nothing when called', () => {
    useAppStore.setState({
      sessions: [
        buildStorySession({
          id: SESSION_ID,
          workspaceId: WORKSPACE_ID,
          archivedAt: STORY_NOW,
        }),
      ],
    });
    const { result } = renderHook(() => useHandOutputToAgent({ sessionId: SESSION_ID }));

    expect(result.current.canHandOff).toBe(false);
    result.current.handOff(OUTPUT);

    expect(useAppStore.getState().outputHandoffs).toEqual({});
  });

  it('hides the verb for a session that is gone and for no session at all', () => {
    const gone = renderHook(() => useHandOutputToAgent({ sessionId: GONE_SESSION_ID }));
    const none = renderHook(() => useHandOutputToAgent({ sessionId: null }));

    expect(gone.result.current.canHandOff).toBe(false);
    expect(none.result.current.canHandOff).toBe(false);
  });

  it('hides the verb when the session has no agent', () => {
    useAppStore.setState({ sessionPhaseRuns: { [SESSION_ID]: [] }, selectedAgentId: {} });
    const { result } = renderHook(() => useHandOutputToAgent({ sessionId: SESSION_ID }));

    expect(result.current.canHandOff).toBe(false);
  });

  it('names the session and opens it when it is not the one on screen', () => {
    const navigate = vi.fn<StoreState['navigate']>();
    restore = { navigate: useAppStore.getState().navigate };
    useAppStore.setState({ navigate });
    const { result } = renderHook(() => useHandOutputToAgent({ sessionId: OTHER_SESSION_ID }));

    expect(result.current.askLabel).toBe('Ask the agent in Refund webhook about this');
    result.current.handOff(OUTPUT);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().outputHandoffs[OTHER_AGENT]).toHaveLength(1);
  });

  it('does not open the session that is already on screen', () => {
    const navigate = vi.fn<StoreState['navigate']>();
    restore = { navigate: useAppStore.getState().navigate };
    useAppStore.setState({ navigate });
    const { result } = renderHook(() => useHandOutputToAgent({ sessionId: SESSION_ID }));

    result.current.handOff(OUTPUT);

    expect(navigate).not.toHaveBeenCalled();
  });
});
