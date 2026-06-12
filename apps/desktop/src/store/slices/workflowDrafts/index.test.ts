// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { createStore } from 'zustand';
import type { SessionId } from '@goodboy/types';
import { createWorkflowDraftsSlice } from './index';
import type { SetFn, GetFn, WorkflowBuilderDraft } from './types';

const SESSION_ID = 'session-1' as SessionId;
const SESSION_ID_2 = 'session-2' as SessionId;

type TestState = {
  workflowDrafts: Record<string, WorkflowBuilderDraft | undefined>;
  setWorkflowDraft: (sessionId: SessionId, draft: WorkflowBuilderDraft) => void;
  clearWorkflowDraft: (sessionId: SessionId) => void;
};

const buildDraft = (overrides: Partial<WorkflowBuilderDraft> = {}): WorkflowBuilderDraft => ({
  mode: 'custom',
  goalText: 'ship it',
  goalHistory: [],
  selectedPresetId: null,
  processText: '',
  plan: null,
  stepEdits: {},
  saveAsPreset: false,
  autoRun: false,
  ...overrides,
});

const makeStore = () =>
  createStore<TestState>((set, get) => ({
    workflowDrafts: {},
    ...createWorkflowDraftsSlice(set as SetFn, get as GetFn),
  }));

describe('workflowDrafts slice', () => {
  it('setWorkflowDraft stores the draft per session', () => {
    const store = makeStore();
    const draft = buildDraft({ goalText: 'wip' });
    store.getState().setWorkflowDraft(SESSION_ID, draft);
    expect(store.getState().workflowDrafts[SESSION_ID]).toEqual(draft);
  });

  it('clearWorkflowDraft removes the per-session entry', () => {
    const store = makeStore();
    store.getState().setWorkflowDraft(SESSION_ID, buildDraft());
    store.getState().clearWorkflowDraft(SESSION_ID);
    expect(store.getState().workflowDrafts[SESSION_ID]).toBeUndefined();
  });

  it('keeps drafts isolated between sessions', () => {
    const store = makeStore();
    const draftA = buildDraft({ goalText: 'a' });
    const draftB = buildDraft({ goalText: 'b' });
    store.getState().setWorkflowDraft(SESSION_ID, draftA);
    store.getState().setWorkflowDraft(SESSION_ID_2, draftB);
    store.getState().clearWorkflowDraft(SESSION_ID);
    expect(store.getState().workflowDrafts[SESSION_ID]).toBeUndefined();
    expect(store.getState().workflowDrafts[SESSION_ID_2]).toEqual(draftB);
  });

  it('clearWorkflowDraft is a no-op when the key is absent', () => {
    const store = makeStore();
    const before = store.getState().workflowDrafts;
    store.getState().clearWorkflowDraft(SESSION_ID);
    expect(store.getState().workflowDrafts).toBe(before);
  });
});
