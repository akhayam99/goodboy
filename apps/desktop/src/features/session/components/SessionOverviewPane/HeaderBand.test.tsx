// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render as renderPlain, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { IsoDateTime, Session, SessionId, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';

vi.mock('./ArchivedRestore', () => ({ ArchivedRestore: () => <button>Restore</button> }));
vi.mock('./ChatOriginRow', () => ({ ChatOriginRow: () => null }));
vi.mock('./ContextChip', () => ({ ContextChip: () => <span>Context</span> }));
vi.mock('./GoalTeaser', () => ({
  GoalTeaser: () => <button type="button">Goal: Keep the ledger balanced</button>,
}));

const render = (ui: ReactNode) => renderPlain(<ToastProvider>{ui}</ToastProvider>);

let useAppStore: StoryStore;
let HeaderBand: typeof import('./HeaderBand').HeaderBand;
let OverviewHeaderActions: typeof import('./OverviewHeaderActions').OverviewHeaderActions;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ HeaderBand } = await import('./HeaderBand'));
  ({ OverviewHeaderActions } = await import('./OverviewHeaderActions'));
}, STORE_IMPORT_TIMEOUT_MS);

const SESSION_ID = 'session-1' as SessionId;
const NOW = '2026-09-28T09:00:00.000Z' as IsoDateTime;

const session: Session = aSession({
  id: SESSION_ID,
  workspaceId: 'workspace-1' as WorkspaceId,
  goal: 'Refactor auth',
});

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ sessions: [session] });
});

afterEach(cleanup);

describe('the Overview header', () => {
  it('leaves the title, the linked work and the artifacts to the session level', () => {
    render(<HeaderBand session={session} />);

    screen.getByRole('button', { name: /^Goal:/ });
    expect(screen.queryByText('Refactor auth')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Link work' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Artifacts/ })).toBeNull();
    expect(screen.queryAllByRole('separator')).toHaveLength(0);
  });

  it('keeps Context and the Overview menu as page actions, and Restore while archived', () => {
    const { unmount } = render(<OverviewHeaderActions session={session} />);
    screen.getByText('Context');
    expect(screen.queryByRole('button', { name: 'Restore' })).toBeNull();
    unmount();

    render(<OverviewHeaderActions session={{ ...session, archivedAt: NOW }} />);
    screen.getByRole('button', { name: 'Restore' });
  });
});
