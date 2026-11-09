// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { aSession, nextSessionId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { WriteFromWorkButton } from '.';

const SESSION_ID = nextSessionId();

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({
    sessions: [aSession({ id: SESSION_ID })],
    currentSessionId: SESSION_ID,
    sessionExternalTasks: {
      [SESSION_ID]: [
        {
          sessionId: SESSION_ID,
          provider: 'linear',
          externalId: 'ext-nw-142',
          identifier: 'NW-142',
          title: 'Retry webhook deliveries on a 502',
          url: 'https://linear.app/northwind/issue/NW-142',
          createdAt: brandId<IsoDateTime>({ value: '2026-10-05T09:00:00.000Z' }),
        },
      ],
    },
  });
});

afterEach(cleanup);

describe('WriteFromWorkButton', () => {
  it('empties the slot with its chip when the goal is written on the page', () => {
    store.getState().openDrawer({ kind: 'explore', sessionId: SESSION_ID, payload: null });
    store.getState().openDrawer({ kind: 'ask', sessionId: SESSION_ID, payload: null });
    render(<WriteFromWorkButton sessionId={SESSION_ID} isLocked={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Write title and goal from linked work' }));

    expect(store.getState().drawer).toBeNull();
    expect(store.getState().drawerBack).toBeNull();
  });
});
