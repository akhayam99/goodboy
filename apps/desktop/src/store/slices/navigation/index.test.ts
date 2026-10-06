// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type {
  Agent,
  AgentId,
  ArtifactId,
  ResolveAttempt,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import { useAppStore, type AppStore } from '../../store';
import type { SessionGithubState } from '../../types';
import { createDrawerSlice } from '../drawer';
import type { DrawerRequest } from '../drawer/state';
import { createNavigationSlice } from '.';
import { dropSession } from './history';
import { locationKey } from './locationKey';
import {
  BOARD_PLACE,
  SESSION_DRAFT_PLACE,
  agentPlace,
  branchPlace,
  fixRunTranscript,
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
  anAgent({
    id: AGENT,
    sessionId: S1,
    name: 'implementer',
    ...overrides,
  });

const githubWithPr = (number: number): SessionGithubState => ({
  pr: {
    number,
    title: 'Guard the settlement batch',
    url: `https://github.com/harborline/ledger-core/pull/${number}`,
    state: 'open',
    mergeable: true,
    checks: 'success',
    baseBranch: 'main',
    headBranch: 'fix/ledger-postings',
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: '2026-09-25T00:00:00.000Z',
  },
  linkedIssues: [],
  fetchedAt: null,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
});

const resolveAttemptFor = ({
  agentId,
  threadIds,
}: {
  readonly agentId: AgentId;
  readonly threadIds: ReadonlyArray<string>;
}): ResolveAttempt => ({
  id: `attempt-${agentId}`,
  sessionId: S1,
  agentId,
  prNumber: null,
  threadIds,
  provider: 'anthropic',
  model: 'sonnet-5',
  effort: null,
  instructions: null,
  phase: 'finished',
  mountTarget: null,
  startedAt: null,
  endedAt: null,
  error: null,
  createdAt: 1,
  batchId: null,
  copyPath: null,
  launchChoice: null,
});

const makeStore = () =>
  create<AppStore>()((set, get) => ({
    ...useAppStore.getInitialState(),
    currentWorkspaceId: WS,
    currentSessionId: null,
    sessions: [aSession({ id: S1 }), aSession({ id: S2 })],
    navigation: {},
    appStudio: null,
    activeLens: {},
    sessionStudio: {},
    selectedAgentId: {},
    focusedWorkflowRunId: {},
    diffFocus: {},
    diffMountPath: {},
    branchTab: {},
    branchThreadId: {},
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
    ...createNavigationSlice({ set, get }),
    ...createDrawerSlice({ set, get }),
  }));

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
    expect(store.getState().activeLens[S1]).toBe('branch');

    store.getState().back();
    expect(store.getState().activeLens[S1]).toBeNull();

    store.getState().back();
    expect(store.getState().currentSessionId).toBeNull();

    store.getState().forward();
    store.getState().forward();
    expect(keyOf(store)).toBe(`s/${S1}/branch/comments`);
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

  it('opens the pull request as the Branch, with its Comments, and Back leaves it', () => {
    const store = makeStore();
    store.setState({ sessionGithub: { [S1]: githubWithPr(528) } });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'linear' }) });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'pr' }) });
    expect(store.getState().activeLens[S1]).toBe('branch');
    expect(keyOf(store)).toBe(`s/${S1}/branch/comments`);

    store.getState().back();
    expect(store.getState().activeLens[S1]).toBe('linear');
  });

  it('keeps the pull request page for a GitLab merge request', () => {
    const store = makeStore();
    store.setState({
      sessionGitlabMr: {
        [S1]: {
          mr: {
            id: 57,
            iid: 57,
            projectId: 9,
            title: 'Retry dispatch with a cap',
            description: null,
            state: 'opened',
            webUrl: 'https://gitlab.example.test/notify-relay/-/merge_requests/57',
            sourceBranch: 'fix/dispatch-retry',
            targetBranch: 'main',
            draft: false,
            hasConflicts: false,
            mergeStatus: 'can_be_merged',
            updatedAt: '2026-09-25T00:00:00.000Z',
          },
          fetchedAt: null,
          loading: false,
          error: null,
        },
      },
    });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'pr' }) });
    expect(store.getState().activeLens[S1]).toBe('pr');
  });

  const transcriptOf = (agentId: AgentId) => ({
    kind: 'transcript' as const,
    sessionId: S1,
    payload: { agentId },
  });

  const withAttempt = (store: ReturnType<typeof makeStore>): void => {
    store.setState({
      sessionResolveAttempts: {
        [S1]: [resolveAttemptFor({ agentId: RESOLVER, threadIds: ['gh:PRRT_42'] })],
      },
    });
  };

  it('opens a resolver with no attempt on Branch Comments, its transcript in the drawer', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    store.getState().navigate({ to: agentPlace({ sessionId: S1, agentId: RESOLVER }) });

    expect(keyOf(store)).toBe(`s/${S1}/branch/comments`);
    expect(store.getState().selectedAgentId[S1]).toBeNull();
    expect(store.getState().drawer).toEqual(transcriptOf(RESOLVER));
  });

  it('opens a resolver on the Comments of its Branch at its thread, never on a page of its own', () => {
    const store = makeStore();
    withAttempt(store);
    store.getState().navigate({ to: agentPlace({ sessionId: S1, agentId: RESOLVER }) });

    expect(keyOf(store)).toBe(`s/${S1}/branch/comments/t/gh:PRRT_42`);
    expect(store.getState().selectedAgentId[S1]).toBeNull();
    expect(store.getState().drawer).toEqual(transcriptOf(RESOLVER));
    expect(store.getState().agentPane[S1]).toBeNull();
  });

  it('lands an old agent tab request for a resolver on the same Comments and drawer', () => {
    for (const pane of ['brief', 'transcript'] as const) {
      const store = makeStore();
      withAttempt(store);
      store.getState().navigate({ to: agentPlace({ sessionId: S1, agentId: RESOLVER, pane }) });

      expect(keyOf(store)).toBe(`s/${S1}/branch/comments/t/gh:PRRT_42`);
      expect(store.getState().drawer).toEqual(transcriptOf(RESOLVER));
    }
  });

  it('rewrites an old fix run address to Branch Comments with the transcript drawer', () => {
    const store = makeStore();
    withAttempt(store);
    store.getState().navigate({
      to: sessionPlace({
        sessionId: S1,
        lens: 'review',
        agentId: RESOLVER,
        target: { kind: 'thread', threadId: 'gh:PRRT_7', pane: 'transcript' },
      }),
    });

    expect(keyOf(store)).toBe(`s/${S1}/branch/comments/t/gh:PRRT_7`);
    expect(store.getState().drawer).toEqual(transcriptOf(RESOLVER));
  });

  it('restores an old fix run address from history onto Comments with the drawer open', () => {
    const store = makeStore();
    withAttempt(store);
    store.getState().restoreLocation({
      location: {
        workspaceId: WS,
        place: sessionPlace({
          sessionId: S1,
          lens: 'review',
          agentId: RESOLVER,
          target: { kind: 'thread', threadId: 'gh:PRRT_42' },
        }),
        studio: null,
        focus: { drawer: null, selection: {}, scroll: {}, revealed: [] },
      },
    });

    expect(keyOf(store)).toBe(`s/${S1}/branch/comments/t/gh:PRRT_42`);
    expect(store.getState().drawer).toEqual(transcriptOf(RESOLVER));
  });

  it('closes the transcript drawer on the next page and brings it back on Back', () => {
    const store = makeStore();
    withAttempt(store);
    store.getState().navigate({ to: agentPlace({ sessionId: S1, agentId: RESOLVER }) });
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'agents' }) });
    expect(store.getState().drawer).toBeNull();

    store.getState().back();

    expect(keyOf(store)).toBe(`s/${S1}/branch/comments/t/gh:PRRT_42`);
    expect(store.getState().drawer).toEqual(transcriptOf(RESOLVER));
  });

  it('keeps a thread link with the transcript drawer on the Comments of the Branch', () => {
    const store = makeStore();
    withAttempt(store);
    store
      .getState()
      .navigate(fixRunTranscript({ sessionId: S1, agentId: RESOLVER, threadId: 'gh:PRRT_42' }));

    expect(keyOf(store)).toBe(`s/${S1}/branch/comments/t/gh:PRRT_42`);
    expect(store.getState().drawer).toEqual(transcriptOf(RESOLVER));
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
    expect(keyOf(store)).toBe(`s/${S1}/branch/comments+workflows`);

    store.getState().back();
    expect(store.getState().appStudio).toEqual({
      kind: 'inbox',
      focus: { provider: 'linear', kind: null, recordKey: 'NW-214', sessionId: null },
    });
    expect(keyOf(store)).toBe(`s/${S1}/branch/comments+inbox/linear/NW-214`);

    store.getState().back();
    expect(store.getState().appStudio).toBeNull();
    expect(store.getState().activeLens[S1]).toBe('branch');
  });

  it('switches a door over the open studio instead of stacking it', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    store.getState().openStudio({ studio: { kind: 'inbox', focus: null } });
    store.getState().switchStudio({ studio: { kind: 'settings', focus: { scope: 'app' } } });
    store.getState().switchStudio({ studio: { kind: 'workflow' } });

    expect(store.getState().appStudio).toEqual({ kind: 'workflow' });
    expect(store.getState().navigation[WS]?.entries.map((entry) => locationKey(entry))).toEqual([
      'board',
      `s/${S1}`,
      `s/${S1}+workflows`,
    ]);
  });

  it('opens a door from a page the same way a content link does', () => {
    const doorStore = makeStore();
    doorStore.getState().switchStudio({ studio: { kind: 'impact', scope: null } });
    const contentStore = makeStore();
    contentStore.getState().openStudio({ studio: { kind: 'impact', scope: null } });

    expect(doorStore.getState().navigation[WS]).toEqual(contentStore.getState().navigation[WS]);
    expect(doorStore.getState().appStudio).toEqual({ kind: 'impact', scope: null });
  });

  it('stacks a content link over the open studio so back returns to it', () => {
    const store = makeStore();
    store.getState().openStudio({ studio: { kind: 'inbox', focus: null } });
    store.getState().openStudio({ studio: { kind: 'settings', focus: { scope: 'app' } } });
    store.getState().back();

    expect(store.getState().appStudio).toEqual({ kind: 'inbox', focus: null });
  });

  it('lands close, back and Esc on the same page with the same forward', () => {
    const closeOutcome = (leave: (store: ReturnType<typeof makeStore>) => void) => {
      const store = makeStore();
      store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'review' }) });
      store.getState().switchStudio({ studio: { kind: 'inbox', focus: null } });
      store.getState().switchStudio({ studio: { kind: 'settings', focus: { scope: 'app' } } });
      leave(store);
      const stack = store.getState().navigation[WS];
      return {
        appStudio: store.getState().appStudio,
        index: stack?.index,
        keys: stack?.entries.map((entry) => locationKey(entry)),
        lens: store.getState().activeLens[S1],
      };
    };

    const closed = closeOutcome((store) => store.getState().closeStudio());
    const backed = closeOutcome((store) => store.getState().back());
    const upped = closeOutcome((store) => store.getState().up());

    expect(closed.appStudio).toBeNull();
    expect(closed).toEqual(backed);
    expect(upped.appStudio).toBeNull();
    expect(upped.keys?.[upped.index ?? 0]).toBe(closed.keys?.[closed.index ?? 0]);
  });

  it('brings the closed studio back on forward after close', () => {
    const store = makeStore();
    store.getState().openStudio({ studio: { kind: 'impact', scope: null } });
    store.getState().closeStudio();
    expect(store.getState().appStudio).toBeNull();

    store.getState().forward();
    expect(store.getState().appStudio).toEqual({ kind: 'impact', scope: null });
  });

  it('rewrites the top entry as a page when nothing sits below the studio', () => {
    const store = makeStore();
    store.getState().openStudio({ studio: { kind: 'impact', scope: null } });
    const top = store.getState().navigation[WS]?.entries[1];
    expect(top).toBeDefined();
    store.setState({ navigation: { [WS]: { entries: top === undefined ? [] : [top], index: 0 } } });
    store.getState().closeStudio();

    expect(store.getState().appStudio).toBeNull();
    expect(store.getState().navigation[WS]?.entries.map((entry) => locationKey(entry))).toEqual([
      'board',
    ]);
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
  kind: 'conversation',
  sessionId: S1,
  payload: { threadId: 'note:ledger-cast' },
};

const EMPTY = { drawer: null, selection: {}, scroll: {}, revealed: [] };

const MOUNT = '/w/payments-api';

const branchOf = (store: ReturnType<typeof makeStore>) => {
  const state = store.getState();
  const stack = state.navigation[state.currentWorkspaceId ?? ''];
  const place = stack?.entries[stack.index]?.place;
  return place?.at === 'session' && place.view.target?.kind === 'branch' ? place.view.target : null;
};

const depthOf = (store: ReturnType<typeof makeStore>): number =>
  store.getState().navigation[WS]?.entries.length ?? 0;

describe('Branch page', () => {
  it('opens the canonical Branch address from every former door', () => {
    const doors = [
      { request: sessionPlace({ sessionId: S1, lens: 'review' }), tab: 'comments' },
      { request: sessionPlace({ sessionId: S1, lens: 'pr' }), tab: 'comments' },
      {
        request: sessionPlace({
          sessionId: S1,
          lens: 'files',
          target: { kind: 'diff', mountPath: MOUNT, focus: null },
        }),
        tab: 'files',
      },
      {
        request: sessionPlace({
          sessionId: S1,
          lens: 'files',
          target: { kind: 'diff', mountPath: MOUNT, focus: null, page: 'history' },
        }),
        tab: 'commits',
      },
    ] as const;
    for (const { request, tab } of doors) {
      const store = makeStore();
      store.getState().navigate({ to: request });
      expect(store.getState().activeLens[S1]).toBe('branch');
      expect(branchOf(store)?.tab).toBe(tab);
    }
  });

  it('reads the same trail whichever door opened it', () => {
    const keys = (['review', 'pr'] as const).map((lens) => {
      const store = makeStore();
      store.getState().navigate({ to: BOARD_PLACE });
      store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
      store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens }) });
      return locationKey(captureWindowLocation({ state: store.getState() }));
    });
    expect(new Set(keys).size).toBe(1);
  });

  it('keeps a requested mount and moves a conversation request into the address', () => {
    const store = makeStore();
    store.getState().navigate({
      to: branchPlace({ sessionId: S1, mountPath: MOUNT }),
      drawer: { kind: 'conversation', sessionId: S1, payload: { threadId: 'thread-9' } },
    });
    expect(branchOf(store)).toMatchObject({
      mountPath: MOUNT,
      tab: 'comments',
      threadId: 'thread-9',
    });
    expect(store.getState().drawer).toBeNull();
    expect(store.getState().branchThreadId[S1]).toBe('thread-9');
  });

  it('switches tabs in place so Back does not walk them', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    store.getState().navigate({ to: branchPlace({ sessionId: S1, mountPath: MOUNT }) });
    const depth = depthOf(store);
    for (const tab of ['files', 'commits', 'checks', 'comments'] as const) {
      store
        .getState()
        .navigate({ to: branchPlace({ sessionId: S1, mountPath: MOUNT, tab }), mode: 'replace' });
    }
    expect(depthOf(store)).toBe(depth);
    store.getState().back();
    expect(store.getState().activeLens[S1]).toBeNull();
  });

  it('sends Up to the crumb on the left, one level at a time', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1 }) });
    store
      .getState()
      .navigate({ to: branchPlace({ sessionId: S1, mountPath: MOUNT, threadId: 'thread-9' }) });
    store.getState().up();
    expect(branchOf(store)).toMatchObject({ tab: 'comments', threadId: null });
    store.getState().up();
    expect(store.getState().activeLens[S1]).toBeNull();
  });

  it('opens history recovery on the Commits tab and redirects the old Rewrite history address', () => {
    const store = makeStore();
    store
      .getState()
      .navigate({ to: branchPlace({ sessionId: S1, mountPath: MOUNT, tab: 'commits' }) });
    expect(branchOf(store)).toMatchObject({ tab: 'commits', mountPath: MOUNT });
    store.getState().navigate({
      to: sessionPlace({
        sessionId: S1,
        lens: 'files',
        target: { kind: 'diff', mountPath: MOUNT, focus: null, page: 'history' },
      }),
    });
    expect(branchOf(store)).toMatchObject({ tab: 'commits', mountPath: MOUNT });
    expect(keyOf(store)).toBe(`s/${S1}/branch/commits:${MOUNT}`);
  });

  it('sends Up from a Fix run to the Comments of its Branch', () => {
    const store = makeStore();
    store.setState({
      sessionResolveAttempts: {
        [S1]: [resolveAttemptFor({ agentId: RESOLVER, threadIds: ['thread-9'] })],
      },
    });
    store.getState().navigate({ to: agentPlace({ sessionId: S1, agentId: RESOLVER }) });
    store.getState().up();
    expect(branchOf(store)).toMatchObject({ tab: 'comments', threadId: null });
  });

  it('restores a saved place that still names a former lens at the Branch address', () => {
    const store = makeStore();
    store.getState().restoreLocation({
      location: {
        workspaceId: WS,
        place: sessionPlace({ sessionId: S1, lens: 'review' }),
        studio: null,
        focus: EMPTY,
      },
    });
    expect(store.getState().activeLens[S1]).toBe('branch');
  });
});
