// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { EMPTY_SESSION_DRAFT } from '../../../../store/slices/sessionDraft/state';
import { harborline, seedColumn } from '../../testing/sessionColumn';
import { NewSessionRow } from './NewSessionRow';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedColumn({ store: useAppStore, sessions: [] });
});

afterEach(cleanup);

describe('the New session row', () => {
  it('asks for a new session and closes a peek when it is clicked', () => {
    const listener = vi.fn();
    const onNavigate = vi.fn();
    window.addEventListener('goodboy:new-session', listener);
    render(<NewSessionRow workspaceId={harborline.id} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'New session' }));
    expect(listener).toHaveBeenCalledOnce();
    expect(onNavigate).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:new-session', listener);
  });

  it('is the current place while the draft is open, without a dot', () => {
    act(() => {
      useAppStore.setState({ openSessionDraftWorkspaceId: harborline.id, currentSessionId: null });
    });
    render(<NewSessionRow workspaceId={harborline.id} />);
    const row = screen.getByRole('button', { name: 'New session' });
    expect(row.getAttribute('aria-current')).toBe('page');
    expect(document.querySelector('[data-slot="draft-dot"]')).toBeNull();
  });

  it('shows a dot while a written draft waits elsewhere', () => {
    act(() => {
      useAppStore.setState({
        sessionDrafts: {
          [harborline.id]: { ...EMPTY_SESSION_DRAFT, workflowGoal: 'Add rate limits' },
        },
      });
    });
    render(<NewSessionRow workspaceId={harborline.id} />);
    const row = screen.getByRole('button', { name: /Draft in progress/ });
    expect(row.getAttribute('aria-current')).toBeNull();
    expect(document.querySelector('[data-slot="draft-dot"]')).not.toBeNull();
  });
});
