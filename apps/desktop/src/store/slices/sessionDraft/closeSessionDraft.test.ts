// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type { SessionId } from '@goodboy/types';
import { aSession, nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import { useAppStore, type AppStore } from '../../store';
import { createNavigationSlice } from '../navigation';
import { BOARD_PLACE, SESSION_DRAFT_PLACE, sessionPlace } from '../navigation/place';
import { parentPlace } from '../navigation/parentPlace';
import { createSessionDraftSlice } from '.';
import { kickoffDraftKey } from '../workflowDrafts/kickoffDraftKey';
import type { WorkflowBuilderDraft } from '../workflowDrafts/types';
import { hasSessionDraftContent } from './hasSessionDraftContent';
import { selectIsSessionDraftShown } from './selectIsSessionDraftShown';
import { selectSessionDraft } from './selectSessionDraft';

const HARBORLINE = nextWorkspaceId();
const NORTHWIND = nextWorkspaceId();
const LEDGER = nextSessionId();

const makeStore = () =>
  create<AppStore>()((set, get) => ({
    ...useAppStore.getInitialState(),
    currentWorkspaceId: HARBORLINE,
    currentSessionId: null,
    projects: [],
    bootstrapPhase: {},
    sessions: [aSession({ id: LEDGER, workspaceId: HARBORLINE })],
    navigation: {},
    appStudio: null,
    drawer: null,
    openSessionDraftWorkspaceId: null,
    sessionDrafts: {},
    workflowDrafts: {},
    setCurrentSession: async (id: SessionId | null) => {
      set((state) => ({
        currentSessionId: id,
        openSessionDraftWorkspaceId: id === null ? state.openSessionDraftWorkspaceId : null,
      }));
    },
    ...createNavigationSlice({ set, get }),
    ...createSessionDraftSlice({ set, get }),
  }));

type Store = ReturnType<typeof makeStore>;

const builderDraft = (): WorkflowBuilderDraft => ({
  mode: 'custom',
  goalText: 'Round it',
  goalHistory: [],
  selectedPresetId: null,
  basePresetId: null,
  processText: '',
  plan: null,
  workflow: {
    name: '',
    description: '',
    goal: 'Round it',
    steps: [],
    origin: 'custom',
    isPreset: false,
  },
  saveAsPreset: false,
  autoRun: false,
  title: '',
  orchestratorModel: { providerOverride: '', modelOverride: '', effortOverride: null },
  providerPool: null,
});

const write = ({
  store,
  workspaceId = HARBORLINE,
}: {
  store: Store;
  workspaceId?: typeof HARBORLINE;
}) =>
  store.getState().patchSessionDraft({
    workspaceId,
    patch: { workflowGoal: 'Round the ledger postings', choice: 'workflow' },
  });

const draftOf = ({
  store,
  workspaceId = HARBORLINE,
}: {
  store: Store;
  workspaceId?: typeof HARBORLINE;
}) => selectSessionDraft({ state: store.getState(), workspaceId });

const openFromSession = (store: Store) => {
  store.getState().navigate({ to: sessionPlace({ sessionId: LEDGER }) });
  store.getState().openSessionDraft();
};

describe('closing the New session draft', () => {
  it('has the place you came from as its parent, and the board when there was none', () => {
    const fromSession = makeStore();
    openFromSession(fromSession);
    expect(parentPlace({ state: fromSession.getState(), place: SESSION_DRAFT_PLACE })).toEqual(
      sessionPlace({ sessionId: LEDGER }),
    );

    const fromNowhere = makeStore();
    fromNowhere.getState().openSessionDraft();
    expect(parentPlace({ state: fromNowhere.getState(), place: SESSION_DRAFT_PLACE })).toEqual(
      BOARD_PLACE,
    );
  });

  it('lets up() leave the draft for the session you were on', () => {
    const store = makeStore();
    openFromSession(store);
    expect(selectIsSessionDraftShown({ state: store.getState() })).toBe(true);

    store.getState().up();

    expect(store.getState().currentSessionId).toBe(LEDGER);
    expect(store.getState().openSessionDraftWorkspaceId).toBeNull();
  });

  it('lets up() leave the draft for the board when it was the first place', () => {
    const store = makeStore();
    store.getState().openSessionDraft();

    store.getState().up();

    expect(store.getState().currentSessionId).toBeNull();
    expect(store.getState().openSessionDraftWorkspaceId).toBeNull();
  });

  it('keeps the draft when it closes, and New brings the text back', () => {
    const store = makeStore();
    openFromSession(store);
    write({ store });

    store.getState().closeSessionDraft({ workspaceId: HARBORLINE });

    expect(store.getState().currentSessionId).toBe(LEDGER);
    expect(draftOf({ store }).workflowGoal).toBe('Round the ledger postings');

    store.getState().openSessionDraft();
    expect(selectIsSessionDraftShown({ state: store.getState() })).toBe(true);
    expect(draftOf({ store }).workflowGoal).toBe('Round the ledger postings');
  });

  it('discards the text and both builder drafts, then leaves the page', () => {
    const store = makeStore();
    openFromSession(store);
    write({ store });
    store.getState().setWorkflowDraft(kickoffDraftKey({ workspaceId: HARBORLINE }), builderDraft());
    store
      .getState()
      .setWorkflowDraft(kickoffDraftKey({ workspaceId: HARBORLINE, lane: 'task' }), builderDraft());

    store.getState().discardSessionDraft({ workspaceId: HARBORLINE });

    const state = store.getState();
    expect(hasSessionDraftContent({ draft: draftOf({ store }) })).toBe(false);
    expect(Object.keys(state.workflowDrafts ?? {})).toEqual([]);
    expect(state.openSessionDraftWorkspaceId).toBeNull();
    expect(state.currentSessionId).toBe(LEDGER);
  });

  it('discards from a draft opened on the board and lands on the board', () => {
    const store = makeStore();
    store.getState().openSessionDraft();
    write({ store });

    store.getState().discardSessionDraft({ workspaceId: HARBORLINE });

    expect(store.getState().openSessionDraftWorkspaceId).toBeNull();
    expect(store.getState().currentSessionId).toBeNull();
    expect(draftOf({ store })).toEqual(draftOf({ store, workspaceId: NORTHWIND }));
  });

  it('leaves the draft of another workspace alone', () => {
    const store = makeStore();
    openFromSession(store);
    write({ store });
    write({ store, workspaceId: NORTHWIND });

    store.getState().discardSessionDraft({ workspaceId: HARBORLINE });

    expect(hasSessionDraftContent({ draft: draftOf({ store }) })).toBe(false);
    expect(draftOf({ store, workspaceId: NORTHWIND }).workflowGoal).toBe(
      'Round the ledger postings',
    );
  });

  it('does not navigate for a workspace that is not on screen', () => {
    const store = makeStore();
    openFromSession(store);

    store.getState().closeSessionDraft({ workspaceId: NORTHWIND });

    expect(selectIsSessionDraftShown({ state: store.getState() })).toBe(true);
  });

  it('does nothing when the draft is not the page on screen', () => {
    const store = makeStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: LEDGER }) });

    store.getState().closeSessionDraft({ workspaceId: HARBORLINE });

    expect(store.getState().currentSessionId).toBe(LEDGER);
  });
});
