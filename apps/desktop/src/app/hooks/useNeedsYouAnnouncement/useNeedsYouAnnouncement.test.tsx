// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

const nowSessions = vi.hoisted(() => {
  const state: { needsYou: ReadonlyArray<unknown> } = { needsYou: [] };
  return state;
});

vi.mock('../../../shared/hooks/useNowSessions', () => ({
  useNowSessions: () => ({ needsYou: nowSessions.needsYou, running: [] }),
}));

vi.mock('./needsYouReasonOf', () => ({
  needsYouReasonOf: () => 'Needs your answer',
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import type { Session } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { AnnouncementRegion } from '../../components/AnnouncementRegion';
import { NeedsYouAnnouncementBridge } from '../../components/NeedsYouAnnouncementBridge';
import { useAnnouncementStore } from '../../../shared/lib/announcer';

const HARBORLINE = aWorkspace({ name: 'Harborline' });
const NORTHWIND = aWorkspace({ name: 'Northwind' });
const RETRY = aSession({ goal: 'Pick the retry backoff for notify-relay' });
const LEDGER = aSession({ goal: 'Round settlement totals in ledger-core' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({ workspaces: [HARBORLINE, NORTHWIND], currentWorkspaceId: HARBORLINE.id });
  nowSessions.needsYou = [];
  useAnnouncementStore.setState({ message: '', sequence: 0 });
});

afterEach(cleanup);

const Tree = () => (
  <>
    <AnnouncementRegion />
    <NeedsYouAnnouncementBridge />
  </>
);

const needing = (sessions: ReadonlyArray<Session>) => {
  nowSessions.needsYou = sessions;
};

const sentence = (): string => screen.getByRole('status').textContent ?? '';

describe('a Needs you transition in the shared polite region', () => {
  it('announces a session the first time it needs you, naming it and the reason', () => {
    const { rerender } = render(<Tree />);
    expect(sentence()).toBe('');

    needing([RETRY]);
    rerender(<Tree />);

    expect(sentence()).toBe('Pick the retry backoff for notify-relay needs you: Needs your answer');
    expect(useAnnouncementStore.getState().sequence).toBe(1);
  });

  it('stays quiet for sessions that already needed you when the app opened', () => {
    needing([RETRY]);

    render(<Tree />);

    expect(sentence()).toBe('');
    expect(useAnnouncementStore.getState().sequence).toBe(0);
  });

  it('announces only the session that arrived, once, and nothing when the list is unchanged', () => {
    needing([RETRY]);
    const { rerender } = render(<Tree />);

    needing([RETRY, LEDGER]);
    rerender(<Tree />);
    expect(sentence()).toBe('Round settlement totals in ledger-core needs you: Needs your answer');

    needing([RETRY, LEDGER]);
    rerender(<Tree />);
    expect(useAnnouncementStore.getState().sequence).toBe(1);

    needing([LEDGER]);
    rerender(<Tree />);
    expect(useAnnouncementStore.getState().sequence).toBe(1);
  });

  it('stays quiet when the person switches to a workspace with sessions waiting', () => {
    render(<Tree />);

    needing([RETRY]);
    act(() => {
      store.setState({ currentWorkspaceId: NORTHWIND.id });
    });

    expect(sentence()).toBe('');
    expect(useAnnouncementStore.getState().sequence).toBe(0);
  });
});
