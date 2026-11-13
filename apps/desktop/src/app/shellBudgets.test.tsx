// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { DrawerEdgeContext } from '@goodboy/ui';
import { brandId, type Agent, type AgentId, type Session, type SessionId } from '@goodboy/types';
import { nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  buildStoryAgent,
  buildStorySession,
  importStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../store/storyHarness';
import type { AppState } from '../store/types';
import { useSessionSummary } from '../features/workspace/hooks/useSessionSummary';
import { ToastProvider } from '../shared/components/Toast';
import { perfSeam } from '../shared/lib/perfSeam';
import { PERF_COUNT_NAMES } from '../shared/lib/perfCountNames';
import { seedSessionWithMounts } from '../__tests__/helpers/seedSessionWithMounts';
import {
  boot,
  installNavigationHooks,
  installStoryBridge,
} from '../__tests__/surfaces/navigation-flows/harness';
import { BrowserPane } from '../features/browser/components/BrowserPane';
import { useBrowserPage } from '../features/browser/hooks/useBrowserPage';
import { selectBrowserTabCount } from '../store/slices/browser/selectBrowserTabCount';
import type { BrowserTabFacts } from '../features/browser/types';
import { ShellToolRail } from './components/ShellToolRail';
import { SHELL_BUDGETS } from './shellBudgets';

installNavigationHooks();
installStoryBridge();

const AGENTS_PER_SESSION = 150;
const ACTIVE_SESSIONS = 7;
const IDLE_MINUTE_MS = 60_000;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type Counts = ReadonlyMap<string, number>;

type CountsOfParams = {
  readonly name: string;
  readonly counts: Counts;
};

const countsOf = ({ name, counts }: CountsOfParams): number => counts.get(name) ?? 0;

type AgentsForParams = {
  readonly session: Session;
  readonly index: number;
};

const agentsFor = ({ session, index }: AgentsForParams): ReadonlyArray<Agent> =>
  Array.from({ length: AGENTS_PER_SESSION }, (_, ordinal) =>
    buildStoryAgent({
      id: brandId<AgentId>({ value: `agent-${index}-${ordinal}` }),
      sessionId: session.id,
      status: 'completed',
    }),
  );

const seedAgents = (): void => {
  const state = useAppStore.getState();
  const runs = Object.fromEntries(
    state.sessions
      .slice(0, ACTIVE_SESSIONS)
      .map((session, index) => [session.id, agentsFor({ session, index })]),
  );
  act(() => {
    useAppStore.setState({ sessionPhaseRuns: { ...state.sessionPhaseRuns, ...runs } });
  });
};

type WriteParams = {
  readonly patch: () => Partial<AppState>;
};

const writeOnce = ({ patch }: WriteParams): Counts => {
  const seen = new Map<string, number>();
  perfSeam.counter = ({ name, amount }) => {
    seen.set(name, (seen.get(name) ?? 0) + (amount ?? 1));
  };
  act(() => {
    useAppStore.setState(patch());
  });
  perfSeam.counter = null;
  return seen;
};

const unrelatedWrite = (): Partial<AppState> => ({ detectedEditors: [] });

const agentWrite = (): Partial<AppState> => {
  const state = useAppStore.getState();
  const agent = Object.values(state.sessionPhaseRuns).find(
    (runs) => runs.length === AGENTS_PER_SESSION,
  )?.[0];
  if (agent === undefined) {
    throw new Error('the shell has no agent to write for');
  }
  return {
    agentTurnState: {
      ...state.agentTurnState,
      [agent.id]: { kind: 'idle', lastActivityAt: STORY_NOW },
    },
  };
};

const sessionWrite = (): Partial<AppState> => ({ sessions: [...useAppStore.getState().sessions] });

afterEach(() => {
  perfSeam.counter = null;
  cleanup();
  vi.useRealTimers();
});

describe('the always-on shell stays inside its budget', () => {
  beforeEach(async () => {
    await boot({ seed: 'pr' });
    await act(async () => {
      useAppStore.getState().navigate({ to: { at: 'board' } });
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    seedAgents();
  });

  it('derives only the session whose agent changed state', () => {
    const counts = writeOnce({ patch: agentWrite });

    expect(countsOf({ name: PERF_COUNT_NAMES.stageDerivations, counts })).toBe(
      SHELL_BUDGETS.stageDerivationsPerAgentWrite,
    );
    expect(countsOf({ name: PERF_COUNT_NAMES.agentsScanned, counts })).toBe(
      SHELL_BUDGETS.agentsScannedPerAgentWrite,
    );
    expect(countsOf({ name: PERF_COUNT_NAMES.stageReadsCompared, counts })).toBe(
      SHELL_BUDGETS.stageReadsComparedPerAgentWrite,
    );
  });

  it('derives nothing on an unrelated write', () => {
    const counts = writeOnce({ patch: unrelatedWrite });

    expect(countsOf({ name: PERF_COUNT_NAMES.stageDerivations, counts })).toBe(
      SHELL_BUDGETS.stageDerivationsPerUnrelatedWrite,
    );
    expect(countsOf({ name: PERF_COUNT_NAMES.agentsScanned, counts })).toBe(0);
  });
});

describe('the tool rail with the drawer edge shown stays inside its budget', () => {
  let edge: HTMLDivElement;

  beforeEach(() => {
    seedSessionWithMounts({ useAppStore });
    seedAgents();
    edge = document.createElement('div');
    document.body.append(edge);
    render(
      <DrawerEdgeContext.Provider value={edge}>
        <ShellToolRail />
      </DrawerEdgeContext.Provider>,
    );
  });

  it('mounts the session tools once with the drawer edge shown', () => {
    expect(document.querySelectorAll('[data-testid="session-tools"]').length).toBe(
      SHELL_BUDGETS.sessionToolsTreesMounted,
    );
  });

  it('draws the one tree in the drawer edge and keeps a seat for it in the rail', () => {
    expect(edge.querySelectorAll('[data-testid="session-tools"]').length).toBe(1);
    expect(document.querySelectorAll('[data-slot="tool-rail-seat"]').length).toBe(1);
  });

  it('loops over no session when an unrelated value changes', () => {
    const counts = writeOnce({ patch: unrelatedWrite });

    expect(countsOf({ name: PERF_COUNT_NAMES.browserTabCount, counts })).toBe(
      SHELL_BUDGETS.allSessionLoopsPerWriteFromToolRail,
    );
  });

  it('loops over no session when a session changes', () => {
    const counts = writeOnce({ patch: sessionWrite });

    expect(countsOf({ name: PERF_COUNT_NAMES.browserTabCount, counts })).toBe(
      SHELL_BUDGETS.allSessionLoopsPerWriteFromToolRail,
    );
  });
});

type FactsParams = {
  readonly count: number;
  readonly sessionId: SessionId;
};

const factsOf = ({ count, sessionId }: FactsParams): ReadonlyArray<BrowserTabFacts> =>
  Array.from({ length: count }, (_, index) => ({
    id: `live-${index}`,
    sessionId,
    url: `https://harborline.dev/page-${index}`,
    title: '',
    state: 'live',
    isShown: false,
    hiddenSinceMs: null,
    openerId: null,
    isPasskeyBlocked: false,
  }));

const listCalls = (): number =>
  storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'browser_tab_list').length;

type IdleParams = {
  readonly tabs: number;
};

type IdleMinute = {
  readonly calls: number;
  readonly hopsPerTab: number;
};

const idleMinuteWithPaneOpen = async ({ tabs }: IdleParams): Promise<IdleMinute> => {
  const sessionId = nextSessionId();
  let hops = 0;
  vi.useFakeTimers();
  act(() => {
    useAppStore.setState({
      sessions: [buildStorySession({ id: sessionId, workspaceId: nextWorkspaceId() })],
    });
  });
  stubStoryInvoke({
    browser_tab_list: () => {
      hops += tabs;
      return factsOf({ count: tabs, sessionId });
    },
    browser_tab_rows_list: [],
    browser_history_state: null,
    browser_favicon: null,
    browser_tab_place: null,
    browser_tab_show: null,
    browser_tab_hide: null,
  });
  render(
    <ToastProvider>
      <BrowserPane sessionId={sessionId} onClose={() => undefined} />
    </ToastProvider>,
  );
  await vi.advanceTimersByTimeAsync(10);
  const callsBefore = listCalls();
  const hopsBefore = hops;
  await vi.advanceTimersByTimeAsync(IDLE_MINUTE_MS);
  return { calls: listCalls() - callsBefore, hopsPerTab: (hops - hopsBefore) / tabs };
};

describe('a pane left open stays inside its budget', () => {
  it.each([1, 4])('lists no tab on a timer with %i live tab(s) off screen', async (tabs) => {
    const { calls, hopsPerTab } = await idleMinuteWithPaneOpen({ tabs });

    expect(calls).toBe(SHELL_BUDGETS.browserListCallsPerIdleMinute);
    expect(hopsPerTab).toBe(SHELL_BUDGETS.mainThreadHopsPerIdleMinutePerTab);
  });
});

describe('the Browser page stays inside its budget', () => {
  it('reads the tab rows of every session with one command', () => {
    const workspaceId = nextWorkspaceId();
    const sessions = Array.from({ length: ACTIVE_SESSIONS }, () =>
      buildStorySession({ id: nextSessionId(), workspaceId }),
    );
    stubStoryInvoke({ browser_tab_rows_list: [], browser_workspace_tab_rows_list: [] });
    act(() => {
      useAppStore.setState({ sessions, currentWorkspaceId: workspaceId });
    });

    renderHook(() => useBrowserPage({ sessionId: sessions[0]?.id ?? null }));

    const reads = storySpies.tauriInvoke.mock.calls.filter(
      ([command]) => typeof command === 'string' && command.endsWith('tab_rows_list'),
    ).length;
    expect(reads).toBe(SHELL_BUDGETS.commandsToListTabsOnBrowserPage);
  });
});

describe('numbers appear before their data', () => {
  it('shows no number for the cost, the agent count or the tab count while nothing has loaded', () => {
    const workspaceId = nextWorkspaceId();
    const session = buildStorySession({ id: nextSessionId(), workspaceId });
    act(() => {
      useAppStore.setState({ sessions: [session], currentWorkspaceId: workspaceId });
    });
    const summary = renderHook(() => useSessionSummary({ session })).result.current;
    const tabs = selectBrowserTabCount({
      state: useAppStore.getState(),
      workspaceId,
    });

    const shown = [tabs, summary.cost, summary.agentCount].filter(
      (value) => typeof value === 'number',
    );

    expect(shown.length).toBe(SHELL_BUDGETS.numbersShownBeforeTheirData);
  });
});
