import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type MountId, type ProjectId, type SessionId } from '@goodboy/types';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { HistoryLiveSession } from '../../../../store/slices/history/types';
import { HistoryLiveNotice } from './HistoryLiveNotice';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

const SESSION_ID = brandId<SessionId>({ value: 'harborline-session' });
const MOUNT_ID = brandId<MountId>({ value: 'ledger-core-mount' });

const LIVE: HistoryLiveSession = {
  token: 'harborline-history',
  undo: [],
  redo: [],
  isBusy: false,
  busySha: null,
  error: 'The branch moved. Refresh and try again.',
  hasConflict: false,
  shouldStashFiles: false,
  pending: {
    busySha: null,
    identity: {
      worktreePath: '/workspace/ledger-core',
      branch: 'harborline',
      projectId: brandId<ProjectId>({ value: 'ledger-core' }),
    },
    expectedHead: 'abc123',
    direction: 'edit',
    plan: null,
    entry: null,
  },
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({ historyLiveSessions: { [MOUNT_ID]: LIVE } });
});

afterEach(cleanup);

describe('HistoryLiveNotice action nodes', () => {
  it('passes Retry, Refresh and Dismiss individually to the notice action slot', () => {
    render(<HistoryLiveNotice sessionId={SESSION_ID} mountId={MOUNT_ID} live={LIVE} />);
    const alert = screen.getByRole('alert');
    const retry = within(alert).getByRole('button', { name: 'Retry' });
    const refresh = within(alert).getByRole('button', { name: 'Refresh' });
    const dismiss = within(alert).getByRole('button', { name: 'Dismiss' });
    expect(retry.parentElement).toBe(refresh.parentElement);
    expect(retry.parentElement).toBe(dismiss.parentElement);
    expect(retry.parentElement?.children).toHaveLength(3);
    expect(retry.parentElement?.parentElement?.parentElement).toBe(alert);
    expect(within(alert).getByText(LIVE.error ?? '')).toBeDefined();

    fireEvent.click(dismiss);

    expect(store.getState().historyLiveSessions[MOUNT_ID]?.error).toBeNull();
  });

  it('disables all recovery actions while the live edit is busy', () => {
    render(
      <HistoryLiveNotice
        sessionId={SESSION_ID}
        mountId={MOUNT_ID}
        live={{ ...LIVE, isBusy: true }}
      />,
    );
    for (const button of screen.getAllByRole('button')) {
      expect(button.hasAttribute('disabled')).toBe(true);
    }
  });
});
