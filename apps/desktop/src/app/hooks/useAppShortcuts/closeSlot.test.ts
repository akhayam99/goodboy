// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type OpenQuestionId, type SessionId } from '@goodboy/types';
import { nextSessionId } from '@goodboy/types/testing';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import type { StoryStore } from '../../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { closeSlot } from './closeSlot';

const SESSION_ID: SessionId = nextSessionId();
const QUESTION_ID = brandId<OpenQuestionId>({ value: 'question-payments-api' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({ currentSessionId: SESSION_ID });
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('closeSlot', () => {
  it('closes the top of the slot and brings the chip back', () => {
    store.getState().openDrawer({ kind: 'explore', sessionId: SESSION_ID, payload: null });
    store.getState().openDrawer({ kind: 'ask', sessionId: SESSION_ID, payload: null });

    closeSlot({});

    expect(store.getState().drawer?.kind).toBe('explore');
    expect(store.getState().drawerBack).toBeNull();
  });

  it('empties the slot for a question opened from Ask without reopening Ask', () => {
    store.getState().openDrawer({
      kind: 'question',
      sessionId: SESSION_ID,
      payload: { questionId: QUESTION_ID, from: 'ask' },
    });

    closeSlot({});

    expect(store.getState().drawer).toBeNull();
  });

  it('leaves the page where it is when the top of the slot is a question', () => {
    store.getState().navigate({ to: sessionPlace({ sessionId: SESSION_ID }) });
    store.getState().navigate({ to: sessionPlace({ sessionId: SESSION_ID, lens: 'questions' }) });
    store.getState().openDrawer({
      kind: 'question',
      sessionId: SESSION_ID,
      payload: { questionId: QUESTION_ID },
    });
    const before = store.getState().navigation;

    closeSlot({});

    expect(store.getState().drawer).toBeNull();
    expect(store.getState().navigation).toEqual(before);
  });

  it('brings a chipped drawer back over a question, then empties the slot', () => {
    store.getState().openDrawer({
      kind: 'question',
      sessionId: SESSION_ID,
      payload: { questionId: QUESTION_ID, from: 'ask' },
    });
    store.getState().openDrawer({ kind: 'explore', sessionId: SESSION_ID, payload: null });
    store.getState().openDrawer({
      kind: 'question',
      sessionId: SESSION_ID,
      payload: { questionId: QUESTION_ID, from: 'ask' },
    });

    store.getState().closeQuestion();
    expect(store.getState().drawer?.kind).toBe('explore');
    expect(store.getState().drawerBack).toBeNull();

    closeSlot({});
    expect(store.getState().drawer).toBeNull();
  });

  it('leaves a drawer parked under a page alone', () => {
    store.getState().openDrawer({ kind: 'ask', sessionId: SESSION_ID, payload: null });
    store.getState().openStudio({ studio: { kind: 'impact', scope: null } });

    closeSlot({});

    expect(store.getState().drawer?.kind).toBe('ask');
    expect(store.getState().appStudio?.kind).toBe('impact');
  });

  it('leaves the drawer alone while a dialog is open over it', () => {
    store.getState().openDrawer({ kind: 'ask', sessionId: SESSION_ID, payload: null });
    document.body.innerHTML = '<div role="dialog"></div>';

    closeSlot({});

    expect(store.getState().drawer?.kind).toBe('ask');
  });
});
