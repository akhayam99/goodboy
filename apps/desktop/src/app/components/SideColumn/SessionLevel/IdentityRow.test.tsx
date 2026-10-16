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
import {
  act,
  cleanup,
  fireEvent,
  render as renderPlain,
  screen,
  within,
} from '@testing-library/react';
import type { IsoDateTime, Session, SessionId, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { brandedId } from '../../../../features/history/testing/brandedId';
import { IdentityRow } from './IdentityRow';

const render = (ui: ReactNode) => renderPlain(<ToastProvider>{ui}</ToastProvider>);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const SESSION_ID = brandedId<SessionId>({ value: 'session-1' });
const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-1' });
const NOW = brandedId<IsoDateTime>({ value: '2026-09-28T09:00:00.000Z' });

const session: Session = aSession({
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Refactor auth',
});

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ sessions: [session] });
});

afterEach(cleanup);

const openMenu = () =>
  fireEvent.click(screen.getByRole('button', { name: 'More session actions' }));

describe('the identity row of the session level', () => {
  it('holds rename, pin, refresh, archive and delete in its menu, delete last', () => {
    render(<IdentityRow session={session} />);

    openMenu();

    const labels = screen
      .getAllByRole('menuitem')
      .map((item) => item.textContent?.replace(/[^A-Za-z. …]/g, '').trim());
    expect(labels).toEqual([
      expect.stringContaining('Rename'),
      expect.stringContaining('Pin session'),
      expect.stringContaining('Refresh'),
      expect.stringContaining('Archive session'),
      expect.stringContaining('Delete session…'),
    ]);
  });

  it('drops rename, pin and refresh from an archived session and offers Unarchive', () => {
    render(<IdentityRow session={{ ...session, archivedAt: NOW }} />);

    openMenu();

    expect(screen.queryByRole('menuitem', { name: /Refresh/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /pin session/i })).toBeNull();
    screen.getByRole('menuitem', { name: /Unarchive session/ });
  });

  it('starts the inline rename from the title and from the menu', () => {
    render(<IdentityRow session={session} />);

    fireEvent.click(screen.getByRole('button', { name: 'Refactor auth' }));
    expect(screen.getByRole('textbox', { name: 'Session title' })).toBeDefined();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Session title' }), { key: 'Escape' });

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /^Rename/ }));
    expect(screen.getByRole('textbox', { name: 'Session title' })).toBeDefined();
  });

  it('deletes the session once through the store after the confirm', async () => {
    const deleteTask = vi.fn(async () => undefined);
    useAppStore.setState({ deleteTask });
    render(<IdentityRow session={session} />);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete session…/ }));
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('dialog', { name: /^Delete .+\?$/ })).getByRole('button', {
          name: 'Delete session',
        }),
      );
    });

    expect(deleteTask).toHaveBeenCalledTimes(1);
    expect(deleteTask).toHaveBeenCalledWith(SESSION_ID);
  });

  it('pins the session from the menu and unpins it again', () => {
    const pinSession = vi.fn(async () => undefined);
    const unpinSession = vi.fn(async () => undefined);
    useAppStore.setState({ pinSession, unpinSession });
    render(<IdentityRow session={session} />);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /^Pin session/ }));
    expect(pinSession).toHaveBeenCalledWith(SESSION_ID);

    cleanup();
    useAppStore.setState({
      sessionPins: { [WORKSPACE_ID]: [{ id: SESSION_ID, at: 1 }] },
    });
    render(<IdentityRow session={session} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Unpin session/ }));
    expect(unpinSession).toHaveBeenCalledWith(SESSION_ID);
  });

  it('renders a backticked title as inline code without the backticks', () => {
    render(<IdentityRow session={{ ...session, goal: 'run `/explore` first' }} />);

    const title = screen.getByRole('button', { name: /run/ });
    expect(title.querySelector('code')?.textContent).toBe('/explore');
    expect(title.textContent).not.toContain('`');
  });

  it('falls back to one untitled label when the session carries no title', () => {
    render(<IdentityRow session={{ ...session, goal: '   ' }} />);

    screen.getByRole('button', { name: 'Untitled session' });
  });
});
