// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type SessionId, type WorkspaceId } from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { captureLocation } from '../../store/slices/navigation/captureLocation';
import { locationKey } from '../../store/slices/navigation/locationKey';
import { agentPlace, sessionPlace } from '../../store/slices/navigation/place';
import { escapeLadder } from './escapeLadder';

const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION = brandId<SessionId>({ value: 'session-ledger-core' });
const AGENT = brandId<AgentId>({ value: 'agent-tester' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    currentWorkspaceId: WORKSPACE,
    sessions: [aSession({ id: SESSION, workspaceId: WORKSPACE })],
    sessionPhaseRuns: { [SESSION]: [anAgent({ id: AGENT, sessionId: SESSION, name: 'tester' })] },
  });
});

afterEach(() => {
  document.body.innerHTML = '';
});

const keyNow = (): string =>
  locationKey({ place: captureLocation({ state: useAppStore.getState() }).place });

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
    useAppStore.getState().navigate({ to: agentPlace({ sessionId: SESSION, agentId: AGENT }) });
    const before = keyNow();
    const field = focusField({ value: 'Check the retry header' });

    escapeLadder({});

    expect(document.activeElement).not.toBe(field);
    expect(field.value).toBe('Check the retry header');
    expect(keyNow()).toBe(before);
  });

  it('goes past an empty field to the back row', () => {
    useAppStore
      .getState()
      .navigate({ to: sessionPlace({ sessionId: SESSION, lens: 'workflows' }) });
    useAppStore.getState().navigate({ to: agentPlace({ sessionId: SESSION, agentId: AGENT }) });
    focusField({ value: '' });

    escapeLadder({});

    expect(keyNow()).toBe(`s/${SESSION}/workflows`);
  });

  it('closes an open drawer before it moves the page', () => {
    useAppStore
      .getState()
      .navigate({ to: sessionPlace({ sessionId: SESSION, lens: 'workflows' }) });
    useAppStore.getState().openDrawer({ kind: 'ask', sessionId: SESSION, payload: null });

    escapeLadder({});

    expect(useAppStore.getState().drawer).toBeNull();
    expect(keyNow()).toBe(`s/${SESSION}/workflows`);
  });

  it('does what the back row does on a list page', () => {
    useAppStore
      .getState()
      .navigate({ to: sessionPlace({ sessionId: SESSION, lens: 'workflows' }) });

    escapeLadder({});

    expect(keyNow()).toBe(`s/${SESSION}`);
  });

  it('does nothing on the Overview, which has no back row', () => {
    useAppStore.getState().navigate({ to: sessionPlace({ sessionId: SESSION }) });
    const depth = useAppStore.getState().navigation[WORKSPACE]?.entries.length ?? 0;

    escapeLadder({});

    expect(keyNow()).toBe(`s/${SESSION}`);
    expect(useAppStore.getState().navigation[WORKSPACE]?.entries.length ?? 0).toBe(depth);
  });

  it('comes back with history instead of a new entry when the parent is the page below', () => {
    useAppStore
      .getState()
      .navigate({ to: sessionPlace({ sessionId: SESSION, lens: 'workflows' }) });
    useAppStore.getState().navigate({ to: agentPlace({ sessionId: SESSION, agentId: AGENT }) });
    const depth = useAppStore.getState().navigation[WORKSPACE]?.entries.length ?? 0;

    escapeLadder({});

    expect(useAppStore.getState().navigation[WORKSPACE]?.entries.length ?? 0).toBe(depth);
    expect(useAppStore.getState().navigation[WORKSPACE]?.index).toBe(depth - 2);
  });
});
