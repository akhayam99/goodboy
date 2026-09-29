import { describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type { Agent, AgentId, ArtifactId, SessionId, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';
import { createDrawerSlice } from '../drawer';
import type { DrawerRequest } from '../drawer/state';
import { createNavigationSlice } from '.';
import { dropSession } from './history';
import { locationKey } from './locationKey';
import {
  BOARD_PLACE,
  SESSION_DRAFT_PLACE,
  agentPlace,
  resolverPagePlace,
  sessionPlace,
} from './place';
import { HISTORY_LIMIT } from './types';
import { captureWindowLocation } from './captureWindowLocation';
import { parseLocation } from '../../../features/workspace/windowLayout';

const WS = 'ws-harborline' as WorkspaceId;
const WS_2 = 'ws-northwind' as WorkspaceId;
const S1 = 'session-ledger-core' as SessionId;
const S2 = 'session-notify-relay' as SessionId;
const AGENT = 'agent-1' as AgentId;
const RESOLVER = 'agent-resolver' as AgentId;
const ARTIFACT = 'artifact-1' as ArtifactId;

const agent = (overrides: Partial<Agent>): Agent =>
  ({
    id: AGENT,
    parentAgentId: null,
    workflowRunId: null,
    stepId: null,
    name: 'implementer',
    ...overrides,
  }) as unknown as Agent;

const makeStore = () =>
  create<AppStore>()(
    (set, get) =>
      ({
        currentWorkspaceId: WS,
        currentSessionId: null,
        sessions: [{ id: S1 }, { id: S2 }],
        navigation: {},
        appStudio: null,
        activeLens: {},
        sessionStudio: {},
        selectedAgentId: {},
        focusedWorkflowRunId: {},
        diffFocus: {},
        diffMountPath: {},
        diffPage: {},
        terminalMountPath: {},
        focusedArtifactId: {},
        focusedGithubIssueNumber: {},
        focusedExternalTask: {},
        drawer: null,
        openSessionDraftWorkspaceId: null,
        contextDrawerTab: {},
        sessionPhaseRuns: {
          [S1]: [agent({}), agent({ id: RESOLVER, name: 'resolve: ana on a.ts:4' })],
        },
        agentKindOverride: { [RESOLVER]: 'resolver' },
        sessionResolveAttempts: {},
        sessionGithub: {},
        sessionGitlabMr: {},
        sessionBitbucketPr: {},
        setCurrentSession: async (id: SessionId | null) => {
          set((state) => ({
            currentSessionId: id,
            activeLens: id === null ? state.activeLens : { ...state.activeLens, [id]: null },
          }));
        },
        selectAgent: async (sessionId: SessionId, agentId: AgentId) => {
          set((state) => ({ selectedAgentId: { ...state.selectedAgentId, [sessionId]: agentId } }));
        },
        ...createNavigationSlice(set, get),
        ...createDrawerSlice(set, get),
      }) as unknown as AppStore,
  );

const keyOf = (store: ReturnType<typeof makeStore>): string => {
  const state = store.getState();
  const stack = state.navigation[state.currentWorkspaceId ?? ''];
  const entry = stack?.entries[stack.index];
  return entry === undefined ? '' : locationKey(entry);
};

describe('restoring a saved window location', () => {
  it('brings back the lens, target, drawer and scroll a reload or relaunch saved', () => {
    const before = makeStore();
    before.getState().navigate({
      to: sessionPlace({
        sessionId: S1,
        lens: 'plans',
        target: { kind: 'artifact', artifactId: ARTIFACT },
      }),
    });
    before.getState().openDrawer({
      kind: 'context',
      sessionId: S1,
      payload: { tab: 'summary', view: 'current' },
    });
    before.getState().amendFocus({ patch: { scroll: { plans: 320 } } });
    const saved = parseLocation({
      value: JSON.parse(JSON.stringify(captureWindowLocation({ state: before.getState() }))),
    });

    const after = makeStore();
    after.getState().restoreLocation({ location: saved! });

    const state = after.getState();
    expect(state.currentSessionId).toBe(S1);
    expect(state.activeLens[S1]).toBe('plans');
    expect(state.focusedArtifactId[S1]).toBe(ARTIFACT);
    expect(state.drawer).toEqual(before.getState().drawer);
    const stack = state.navigation[WS];
    expect(stack?.entries[stack.index]?.focus.scroll).toEqual({ plans: 320 });
  });

  it('falls back to the board when the saved session is gone', () => {
    const store = makeStore();
    store.getState().restoreLocation({
      location: {
        workspaceId: WS,
        place: {
          at: 'session',
          sessionId: 'session-deleted' as SessionId,
          view: { lens: 'review', agentId: null, studio: null, target: null },
        },
        studio: null,
        focus: { drawer: null, selection: {}, scroll: {}, revealed: [] },
      },
    });
    expect(store.getState().currentSessionId).toBeNull();
    expect(keyOf(store)).toBe('board');
  });
});

describe('navigation slice', () => {
  it('turns an old Context page into the overview with the Context drawer on its tab', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'decisions' }) });

    expect(store.getState().activeLens[S1]).toBeNull();
    expect(store.getState().drawer).toEqual({
      kind: 'context',
      sessionId: S1,
      payload: { tab: 'decisions', view: 'current' },
    });
    expect(keyOf(store)).toBe(`s/${S1}`);

    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'context' }) });
    expect(store.getState().drawer).toMatchObject({ payload: { tab: 'summary' } });
  });

  it('opens the new session draft as its own entry and Back leaves it', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    store.getState().navigate({ to: SESSION_DRAFT_PLACE });

    expect(store.getState().currentSessionId).toBeNull();
    expect(store.getState().openSessionDraftWorkspaceId).toBe(WS);
    expect(keyOf(store)).toBe('new');

    store.getState().back();
    expect(store.getState().currentSessionId).toBe(S1);
    expect(store.getState().openSessionDraftWorkspaceId).toBeNull();

    store.getState().forward();
    expect(store.getState().openSessionDraftWorkspaceId).toBe(WS);
    store.getState().navigate({ to: BOARD_PLACE });
    expect(store.getState().openSessionDraftWorkspaceId).toBeNull();
    expect(keyOf(store)).toBe('board');
  });

  it('pushes a voice per place and walks back and forward', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'review' }) });
    store.getState().navigate({ to: BOARD_PLACE });

    store.getState().back();
    expect(store.getState().currentSessionId).toBe(S1);
    expect(store.getState().activeLens[S1]).toBe('review');

    store.getState().back();
    expect(store.getState().activeLens[S1]).toBeNull();

    store.getState().back();
    expect(store.getState().currentSessionId).toBeNull();

    store.getState().forward();
    store.getState().forward();
    expect(keyOf(store)).toBe(`s/${S1}/review`);
  });

  it('truncates the forward entries on a new push', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'agents' }) });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'plans' }) });
    store.getState().back();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'files' }) });
    store.getState().forward();
    expect(store.getState().activeLens[S1]).toBe('files');
  });

  it('restores the sub-position of a voice on back', () => {
    const store = makeStore();
    store.getState().navigate({
      to: sessionPlace({
        sessionId: S1,
        lens: 'plans',
        target: { kind: 'artifact', artifactId: ARTIFACT },
      }),
    });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'review' }) });
    expect(store.getState().focusedArtifactId[S1]).toBeNull();

    store.getState().back();
    expect(store.getState().activeLens[S1]).toBe('plans');
    expect(store.getState().focusedArtifactId[S1]).toBe(ARTIFACT);
  });

  it('amends the focus of the current voice without pushing', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'review' }) });
    store.getState().amendFocus({ patch: { selection: { thread: 'gh:PRRT_42' } } });
    store.getState().amendFocus({ patch: { scroll: { queue: 120 } } });
    const stack = store.getState().navigation[WS];
    expect(stack?.entries).toHaveLength(2);
    expect(stack?.entries[1]?.focus).toEqual({
      drawer: null,
      selection: { thread: 'gh:PRRT_42' },
      scroll: { queue: 120 },
      revealed: [],
    });
  });

  it('opens the next place with an empty focus and brings the old one back on back', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'review' }) });
    store.getState().amendFocus({ patch: { selection: { thread: 'gh:PRRT_42' } } });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'agents' }) });
    const stack = store.getState().navigation[WS];
    expect(stack?.entries[stack.index]?.focus.selection).toEqual({});

    store.getState().back();
    const back = store.getState().navigation[WS];
    expect(back?.entries[back.index]?.focus.selection).toEqual({ thread: 'gh:PRRT_42' });
  });

  it('replaces the top voice in replace mode', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'agents' }) });
    store.getState().navigate({
      to: sessionPlace({ sessionId: S1, lens: 'plans' }),
      mode: 'replace',
    });
    store.getState().back();
    expect(store.getState().activeLens[S1]).toBeNull();
  });

  it('keeps the pull request lens on a GitHub PR, apart from Review', () => {
    const store = makeStore();
    store.setState({ sessionGithub: { [S1]: { pr: { number: 528 } } } } as never);
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'linear' }) });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'pr' }) });
    expect(store.getState().activeLens[S1]).toBe('pr');
    expect(keyOf(store)).toBe(`s/${S1}/pr`);

    store.getState().back();
    expect(store.getState().activeLens[S1]).toBe('linear');
  });

  it('opens an agent under its home lens', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    store.getState().navigate({ to: agentPlace({ sessionId: S1, agentId: RESOLVER }) });
    expect(store.getState().activeLens[S1]).toBe('review');
    expect(store.getState().selectedAgentId[S1]).toBe(RESOLVER);
  });

  it('opens a resolver as its transcript layer over the comment in Review', () => {
    const store = makeStore();
    store.setState({
      sessionResolveAttempts: { [S1]: [{ agentId: RESOLVER, threadIds: ['gh:PRRT_42'] }] },
    } as never);
    store.getState().navigate({ to: agentPlace({ sessionId: S1, agentId: RESOLVER }) });

    expect(keyOf(store)).toBe(`s/${S1}/review/t/gh:PRRT_42/agent`);
    expect(store.getState().selectedAgentId[S1]).toBe(RESOLVER);
    store.getState().up();
    expect(store.getState().drawer).toEqual({
      kind: 'conversation',
      sessionId: S1,
      payload: { threadId: 'gh:PRRT_42' },
    });
  });

  it('carries the requested agent tab in the address of a resolver page', () => {
    const store = makeStore();
    store.setState({
      sessionResolveAttempts: { [S1]: [{ agentId: RESOLVER, threadIds: ['gh:PRRT_42'] }] },
    } as never);
    store.getState().navigate({
      to: agentPlace({ sessionId: S1, agentId: RESOLVER, pane: 'brief' }),
    });

    expect(keyOf(store)).toBe(`s/${S1}/review/t/gh:PRRT_42/agent/brief`);
    expect(store.getState().agentPane[S1]).toBe('brief');
    expect(captureWindowLocation({ state: store.getState() })?.place).toEqual(
      resolverPagePlace({
        sessionId: S1,
        agentId: RESOLVER,
        threadId: 'gh:PRRT_42',
        pane: 'brief',
      }),
    );
  });

  it('asks for the transcript and clears the tab when the page changes', () => {
    const store = makeStore();
    store.setState({
      sessionResolveAttempts: { [S1]: [{ agentId: RESOLVER, threadIds: ['gh:PRRT_42'] }] },
    } as never);
    store.getState().navigate({
      to: agentPlace({ sessionId: S1, agentId: RESOLVER, pane: 'transcript' }),
    });
    expect(store.getState().agentPane[S1]).toBe('transcript');

    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'agents' }) });
    expect(store.getState().agentPane[S1]).toBeNull();
  });

  it('restores the requested tab on Back', () => {
    const store = makeStore();
    store.setState({
      sessionResolveAttempts: { [S1]: [{ agentId: RESOLVER, threadIds: ['gh:PRRT_42'] }] },
    } as never);
    store.getState().navigate({
      to: agentPlace({ sessionId: S1, agentId: RESOLVER, pane: 'brief' }),
    });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'agents' }) });
    store.getState().back();

    expect(store.getState().agentPane[S1]).toBe('brief');
    expect(keyOf(store)).toBe(`s/${S1}/review/t/gh:PRRT_42/agent/brief`);
  });

  it('addresses the resolver page under its comment and goes back to the open comment', () => {
    const store = makeStore();
    const conversation = {
      kind: 'conversation' as const,
      sessionId: S1,
      payload: { threadId: 'gh:PRRT_42' },
    };
    store.setState({
      sessionResolveAttempts: { [S1]: [{ agentId: RESOLVER, threadIds: ['gh:PRRT_42'] }] },
    } as never);
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'review' }) });
    store.getState().openDrawer(conversation);
    store.getState().navigate({
      to: resolverPagePlace({ sessionId: S1, agentId: RESOLVER, threadId: 'gh:PRRT_42' }),
    });
    expect(keyOf(store)).toBe(`s/${S1}/review/t/gh:PRRT_42/agent`);
    expect(store.getState().drawer).toBeNull();

    store.getState().up();
    expect(store.getState().drawer).toEqual(conversation);
    expect(store.getState().selectedAgentId[S1]).toBeNull();
  });

  it('goes up from a resolver page reached from elsewhere to the queue with its comment', () => {
    const store = makeStore();
    store.setState({
      sessionResolveAttempts: { [S1]: [{ agentId: RESOLVER, threadIds: ['gh:PRRT_42'] }] },
    } as never);
    store.getState().navigate({
      to: resolverPagePlace({ sessionId: S1, agentId: RESOLVER, threadId: 'gh:PRRT_42' }),
    });
    store.getState().up();

    expect(keyOf(store)).toBe(`s/${S1}/review`);
    expect(store.getState().drawer).toEqual({
      kind: 'conversation',
      sessionId: S1,
      payload: { threadId: 'gh:PRRT_42' },
    });
  });

  it('goes up with a back when the previous voice is the parent', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'agents' }) });
    store.getState().amendFocus({ patch: { scroll: { list: 300 } } });
    store.getState().navigate({ to: agentPlace({ sessionId: S1, agentId: AGENT }) });
    store.getState().up();
    const stack = store.getState().navigation[WS];
    expect(stack?.index).toBe(1);
    expect(stack?.entries).toHaveLength(3);
    expect(stack?.entries[1]?.focus.scroll).toEqual({ list: 300 });
    expect(store.getState().selectedAgentId[S1]).toBeNull();
  });

  it('goes up with a clean push when the user did not come from the parent', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    store.getState().navigate({ to: agentPlace({ sessionId: S1, agentId: AGENT }) });
    store.getState().up();
    expect(keyOf(store)).toBe(`s/${S1}/agents`);
    expect(store.getState().navigation[WS]?.entries).toHaveLength(4);
  });

  it('closes a studio by folding the side trips into the base', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'workflows' }) });
    store.getState().navigate({
      to: sessionPlace({ sessionId: S1, lens: 'workflows', studio: { kind: 'workflow' } }),
    });
    store.getState().navigate({
      to: sessionPlace({ sessionId: S1, lens: 'workflows', studio: { kind: 'mr' } }),
    });
    store.getState().up();
    const stack = store.getState().navigation[WS];
    expect(store.getState().sessionStudio[S1]).toBeNull();
    expect(stack?.entries.map((entry) => locationKey(entry))).toEqual([
      'board',
      `s/${S1}/workflows`,
    ]);
  });

  it('pushes an app studio over the place and walks back to it with its focus', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'review' }) });
    store.getState().openStudio({ studio: { kind: 'inbox', focus: null } });
    store.getState().amendStudio({
      studio: {
        kind: 'inbox',
        focus: { provider: 'linear', kind: null, recordKey: 'NW-214', sessionId: null },
      },
    });
    store.getState().openStudio({ studio: { kind: 'workflow' } });
    expect(keyOf(store)).toBe(`s/${S1}/review+workflows`);

    store.getState().back();
    expect(store.getState().appStudio).toEqual({
      kind: 'inbox',
      focus: { provider: 'linear', kind: null, recordKey: 'NW-214', sessionId: null },
    });
    expect(keyOf(store)).toBe(`s/${S1}/review+inbox/linear/NW-214`);

    store.getState().back();
    expect(store.getState().appStudio).toBeNull();
    expect(store.getState().activeLens[S1]).toBe('review');
  });

  it('closes an app studio by folding every studio voice into the base', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    store.getState().openStudio({ studio: { kind: 'inbox', focus: null } });
    store.getState().openStudio({ studio: { kind: 'settings', focus: { scope: 'app' } } });
    store.getState().closeStudio();
    const stack = store.getState().navigation[WS];
    expect(store.getState().appStudio).toBeNull();
    expect(stack?.entries.map((entry) => locationKey(entry))).toEqual(['board', `s/${S1}`]);
  });

  it('replaces the studio voice when the same studio opens again', () => {
    const store = makeStore();
    store.getState().openStudio({ studio: { kind: 'settings', focus: { scope: 'app' } } });
    store.getState().openStudio({ studio: { kind: 'settings', focus: { scope: 'providers' } } });
    expect(store.getState().navigation[WS]?.entries).toHaveLength(2);
    expect(keyOf(store)).toBe('board+settings/providers');
  });

  it('closes the studio on a forward move and finds it again on back', () => {
    const store = makeStore();
    store.getState().openStudio({ studio: { kind: 'notifications' } });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'agents' }) });
    expect(store.getState().appStudio).toBeNull();

    store.getState().back();
    expect(store.getState().appStudio).toEqual({ kind: 'notifications' });
    expect(store.getState().currentSessionId).toBeNull();
  });

  it('goes up out of an app studio before it leaves the page', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'agents' }) });
    store.getState().openStudio({ studio: { kind: 'changelog' } });
    store.getState().up();
    expect(store.getState().appStudio).toBeNull();
    expect(store.getState().activeLens[S1]).toBe('agents');
  });

  it('closes the drawer on a forward move and brings it back on back', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'review' }) });
    store.getState().openDrawer(DRAFTS);
    store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    expect(store.getState().drawer).toBeNull();

    store.getState().back();
    expect(store.getState().drawer).toEqual(DRAFTS);

    store.getState().forward();
    expect(store.getState().drawer).toBeNull();
  });

  it('closes the drawer when an agent opens and restores it on back', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'agents' }) });
    store.getState().openDrawer(DRAFTS);
    store.getState().navigate({ to: agentPlace({ sessionId: S1, agentId: AGENT }) });
    expect(store.getState().drawer).toBeNull();

    store.getState().back();
    expect(store.getState().drawer).toEqual(DRAFTS);
  });

  it('closes the drawer in place on request, without a history entry', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'review' }) });
    store.getState().openDrawer(DRAFTS);
    store.getState().closeDrawer();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    store.getState().back();

    expect(store.getState().drawer).toBeNull();
    expect(store.getState().navigation[WS]?.entries).toHaveLength(3);
  });

  it('keeps one stack per workspace', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'review' }) });
    store.setState({ currentWorkspaceId: WS_2, currentSessionId: null });
    store.getState().navigate({ to: sessionPlace({ sessionId: S2 }) });
    expect(store.getState().navigation[WS_2]?.entries).toHaveLength(2);
    store.setState({ currentWorkspaceId: WS, currentSessionId: S1 });
    store.getState().back();
    expect(store.getState().currentSessionId).toBeNull();
  });

  it('caps the stack at the history limit', () => {
    const store = makeStore();
    Array.from({ length: HISTORY_LIMIT + 10 }, (_, index) =>
      store.getState().navigate({
        to: sessionPlace({ sessionId: index % 2 === 0 ? S1 : S2 }),
      }),
    );
    expect(store.getState().navigation[WS]?.entries).toHaveLength(HISTORY_LIMIT);
  });

  it('drops the voices of an evicted session and folds the duplicates', () => {
    const board = { workspaceId: WS, place: BOARD_PLACE, studio: null, focus: EMPTY };
    const s1 = {
      workspaceId: WS,
      place: sessionPlace({ sessionId: S1 }),
      studio: null,
      focus: EMPTY,
    };
    const s2 = {
      workspaceId: WS,
      place: sessionPlace({ sessionId: S2 }),
      studio: null,
      focus: EMPTY,
    };
    const dropped = dropSession({
      stack: { entries: [board, s1, board, s2], index: 3 },
      sessionId: S1,
    });
    expect(dropped.entries.map((entry) => locationKey(entry))).toEqual(['board', `s/${S2}`]);
    expect(dropped.index).toBe(1);
  });
});

const DRAFTS: DrawerRequest = {
  kind: 'diff-notes',
  sessionId: S1,
  payload: {},
};

const EMPTY = { drawer: null, selection: {}, scroll: {}, revealed: [] };

const layersOf = (store: ReturnType<typeof makeStore>): ReadonlyArray<string> => {
  const state = store.getState();
  const stack = state.navigation[state.currentWorkspaceId ?? ''];
  return stack?.entries[stack.index]?.layers ?? [];
};

const depthOf = (store: ReturnType<typeof makeStore>): number =>
  store.getState().navigation[WS]?.entries.length ?? 0;

const DIFF = sessionPlace({
  sessionId: S1,
  lens: 'files',
  target: { kind: 'diff', mountPath: '/w/payments-api', focus: null },
});

const HISTORY = sessionPlace({
  sessionId: S1,
  lens: 'files',
  target: { kind: 'diff', mountPath: '/w/payments-api', focus: null, page: 'history' },
});

describe('code host layers', () => {
  it('stacks each layer opened from inside to the right, and Back removes one', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'pr' }) });
    expect(layersOf(store)).toEqual([]);
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'review' }) });
    expect(layersOf(store)).toEqual(['pr']);

    store.getState().back();
    expect(store.getState().activeLens[S1]).toBe('pr');
    store.getState().back();
    expect(store.getState().activeLens[S1]).toBeNull();
  });

  it('reads Overview, Diff, pull request when the pull request is opened from the diff', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    store.getState().navigate({ to: DIFF });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'pr' }) });
    expect(layersOf(store)).toEqual(['diff']);
  });

  it('pops back to a kind already in the trail instead of stacking a copy', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'pr' }) });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'review' }) });
    store.getState().navigate({ to: DIFF });
    expect(layersOf(store)).toEqual(['pr', 'review']);
    const depth = depthOf(store);

    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'pr' }) });
    expect(store.getState().activeLens[S1]).toBe('pr');
    expect(layersOf(store)).toEqual([]);
    expect(depthOf(store)).toBe(depth);

    store.getState().forward();
    expect(store.getState().activeLens[S1]).toBe('review');
  });

  it('keeps Rewrite history a child of its diff, and the diff crumb pops back to it', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'pr' }) });
    store.getState().navigate({ to: DIFF });
    store.getState().navigate({ to: HISTORY });
    expect(layersOf(store)).toEqual(['pr']);
    const depth = depthOf(store);

    store.getState().navigate({ to: DIFF });
    expect(store.getState().diffPage[S1] ?? null).toBeNull();
    expect(layersOf(store)).toEqual(['pr']);
    expect(depthOf(store)).toBe(depth);
  });

  it('gives a jump from outside the canonical path of its target', () => {
    const store = makeStore();
    store.setState({ sessionGithub: { [S1]: { pr: { number: 318 } } } } as never);
    store.getState().navigate({ to: BOARD_PLACE });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'review' }) });
    expect(layersOf(store)).toEqual(['pr']);

    store.getState().navigate({ to: sessionPlace({ sessionId: S2, lens: 'review' }) });
    expect(layersOf(store)).toEqual([]);
  });

  it('opens Review from the Overview with the Overview as its only parent', () => {
    const store = makeStore();
    store.setState({ sessionGithub: { [S1]: { pr: { number: 318 } } } } as never);
    store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'review' }) });
    expect(layersOf(store)).toEqual([]);
  });

  it('pushes a focused diff instead of popping to the diff below', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    store.getState().navigate({ to: DIFF });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'review' }) });
    const depth = depthOf(store);
    store.getState().navigate({
      to: sessionPlace({
        sessionId: S1,
        lens: 'files',
        target: {
          kind: 'diff',
          mountPath: '/w/payments-api',
          focus: { kind: 'branch', path: 'src/webhooks.ts' },
        },
      }),
    });
    expect(depthOf(store)).toBe(depth + 1);
    expect(layersOf(store)).toEqual([]);
  });

  it('drops the layers when a layer opens a page that is not one', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'pr' }) });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'review' }) });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'agents' }) });
    expect(layersOf(store)).toEqual([]);

    store.getState().back();
    expect(layersOf(store)).toEqual(['pr']);
  });
});
