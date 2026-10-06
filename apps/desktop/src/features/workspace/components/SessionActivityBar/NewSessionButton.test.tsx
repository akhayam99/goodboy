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
import { harborline, seedColumn } from '../../../../__tests__/helpers/sessionColumn';
import { NewSessionButton } from './NewSessionButton';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedColumn({ store: useAppStore, sessions: [] });
});

afterEach(cleanup);

const mount = () => render(<NewSessionButton workspaceId={harborline.id} />);

describe('the New session button', () => {
  it('asks for a new session when it is clicked', () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:new-session', listener);
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Create new session' }));
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:new-session', listener);
  });

  it('is held selected while the draft is open', () => {
    act(() => {
      useAppStore.setState({ openSessionDraftWorkspaceId: harborline.id });
    });
    mount();
    const button = screen.getByRole('button', { name: 'Create new session' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
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
    mount();
    const button = screen.getByRole('button', { name: /Draft in progress/ });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelector('[data-slot="draft-dot"]')).not.toBeNull();
  });
});
