// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type SessionId, type WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { captureLocation } from '../../store/slices/navigation/captureLocation';
import { locationKey } from '../../store/slices/navigation/locationKey';
import { sessionPlace } from '../../store/slices/navigation/place';
import { escapeLadder } from './escapeLadder';

const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION = brandId<SessionId>({ value: 'session-ledger-core' });
const RUN_ID = 'run-ledger-core-retries';

const RUNS = sessionPlace({ sessionId: SESSION, lens: 'workflows' });
const RUN = sessionPlace({
  sessionId: SESSION,
  lens: 'workflows',
  target: { kind: 'run', runId: RUN_ID },
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    currentWorkspaceId: WORKSPACE,
    currentSessionId: SESSION,
    sessions: [aSession({ id: SESSION, workspaceId: WORKSPACE })],
  });
});

afterEach(() => {
  document.body.innerHTML = '';
});

const keyNow = (): string =>
  locationKey({ place: captureLocation({ state: useAppStore.getState() }).place });

const depthNow = (): number => useAppStore.getState().navigation[WORKSPACE]?.entries.length ?? 0;

type FieldParams = {
  readonly value: string;
};

const focusField = ({ value }: FieldParams): HTMLTextAreaElement => {
  const field = document.createElement('textarea');
  field.value = value;
  document.body.append(field);
  field.focus();
  return field;
};

describe('the Esc ladder', () => {
  it('leaves a field that holds text and keeps the text and the page', () => {
    useAppStore.getState().navigate({ to: RUN });
    const field = focusField({ value: 'Check the retry header' });

    escapeLadder({});

    expect(document.activeElement).not.toBe(field);
    expect(field.value).toBe('Check the retry header');
    expect(keyNow()).toBe(`s/${SESSION}/workflows/${RUN_ID}`);
  });

  it('goes past an empty field to the back row', () => {
    useAppStore.getState().navigate({ to: RUN });
    focusField({ value: '' });

    escapeLadder({});

    expect(keyNow()).toBe(`s/${SESSION}/workflows`);
  });

  it('treats a focused checkbox as an empty field and goes on to the back row', () => {
    useAppStore.getState().navigate({ to: RUN });
    const box = document.createElement('input');
    box.type = 'checkbox';
    document.body.append(box);
    box.focus();

    escapeLadder({});

    expect(keyNow()).toBe(`s/${SESSION}/workflows`);
  });

  it('leaves the page and the drawer alone while a menu or dialog is open', () => {
    useAppStore.getState().navigate({ to: RUN });
    useAppStore.getState().openDrawer({ kind: 'ask', sessionId: SESSION, payload: null });
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.append(dialog);

    escapeLadder({});

    expect(useAppStore.getState().drawer).not.toBeNull();
    expect(keyNow()).toBe(`s/${SESSION}/workflows/${RUN_ID}`);
  });

  it('closes an open drawer before it moves the page', () => {
    useAppStore.getState().navigate({ to: RUNS });
    useAppStore.getState().openDrawer({ kind: 'ask', sessionId: SESSION, payload: null });

    escapeLadder({});

    expect(useAppStore.getState().drawer).toBeNull();
    expect(keyNow()).toBe(`s/${SESSION}/workflows`);
  });

  it('does what the back row does on a list page', () => {
    useAppStore.getState().navigate({ to: RUNS });

    escapeLadder({});

    expect(keyNow()).toBe(`s/${SESSION}`);
  });

  it('does nothing on the Overview, which has no back row', () => {
    useAppStore.getState().navigate({ to: sessionPlace({ sessionId: SESSION }) });
    const depth = depthNow();

    escapeLadder({});

    expect(keyNow()).toBe(`s/${SESSION}`);
    expect(depthNow()).toBe(depth);
  });

  it('comes back with history instead of a new entry when the parent is the page below', () => {
    useAppStore.getState().navigate({ to: RUNS });
    useAppStore.getState().navigate({ to: RUN });
    const depth = depthNow();

    escapeLadder({});

    expect(depthNow()).toBe(depth);
    expect(useAppStore.getState().navigation[WORKSPACE]?.index).toBe(depth - 2);
    expect(keyNow()).toBe(`s/${SESSION}/workflows`);
  });
});
