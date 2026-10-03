// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { LinkedSessionButtons } from './LinkedSessionButtons';

let useAppStore: StoryStore;

const RETRY = aSession({ id: 's-retry' as SessionId, goal: 'Retry failed payments' });
const COPY = aSession({ id: 's-copy' as SessionId, goal: 'Show retry attempts' });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ sessions: [RETRY, COPY] });
});

afterEach(cleanup);

describe('LinkedSessionButtons', () => {
  it('keeps the single Open session button when one session links the task', () => {
    render(<LinkedSessionButtons sessionIds={[RETRY.id]} onOpened={vi.fn()} />);

    expect(screen.getByRole('button').textContent).toBe('Open session');
    expect(screen.queryByRole('group', { name: 'Sessions on this task' })).toBeNull();
  });

  it('names every session that links the task', () => {
    render(<LinkedSessionButtons sessionIds={[RETRY.id, COPY.id]} onOpened={vi.fn()} />);

    const group = screen.getByRole('group', { name: 'Sessions on this task' });
    expect(
      within(group)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Retry failed payments', 'Show retry attempts']);
  });
});
