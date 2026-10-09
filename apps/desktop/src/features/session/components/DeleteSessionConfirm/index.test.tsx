// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

const { archiveMock } = vi.hoisted(() => ({
  archiveMock: vi.fn(async () => undefined),
}));

vi.mock('../../hooks/useSessionArchive', () => ({
  useSessionArchive: () => ({ archive: archiveMock, restore: vi.fn(async () => undefined) }),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { DeleteSessionConfirm } from '.';

const SESSION_ID = 'session-ledger-export' as SessionId;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  archiveMock.mockClear();
});

const session = aSession({ id: SESSION_ID, goal: 'Reconcile the ledger export' });

describe('DeleteSessionConfirm copy', () => {
  it('says in two short lines what is removed and what is kept, branches included', () => {
    useAppStore.setState({ sessionBranches: { [SESSION_ID]: 'mq/ledger-export' } });

    render(<DeleteSessionConfirm session={session} onClose={vi.fn()} />);

    screen.getByText('Removed: transcript, file versions, images.');
    screen.getByText('Kept: branches, cost, uncommitted worktrees.');
    screen.getByText('This cannot be undone.');
    expect(screen.queryByText(/archive instead/i, { selector: 'p' })).toBeNull();
  });

  it('keeps only the cost for a branchless session, without a branch to keep', () => {
    useAppStore.setState({ sessionBranches: { [SESSION_ID]: '' } });

    render(<DeleteSessionConfirm session={session} onClose={vi.fn()} />);

    screen.getByText('Removed: transcript, file versions, images.');
    screen.getByText('Kept: cost.');
    expect(screen.queryByText(/branches/)).toBeNull();
  });
});

describe('DeleteSessionConfirm archive instead', () => {
  it('archives through the shared path, so the safer option still offers an undo', async () => {
    render(<DeleteSessionConfirm session={session} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Archive instead' }));

    await waitFor(() => expect(archiveMock).toHaveBeenCalledWith({ sessions: [session] }));
  });
});
