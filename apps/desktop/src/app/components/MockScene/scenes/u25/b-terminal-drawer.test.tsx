// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('../../../../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel', () => ({
  LazyGenericTerminalPanel: ({ terminalId }: LazyGenericTerminalPanelParams) => (
    <div data-testid="terminal-panel" data-terminal={terminalId} />
  ),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { MOCK_SCENES } from '../..';
import { U25_B_TERMINAL_DRAWER_SCENES } from './b-terminal-drawer';

type LazyGenericTerminalPanelParams = {
  readonly terminalId: string;
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

const settle = (): Promise<void> =>
  act(() => new Promise<void>((resolve) => window.setTimeout(resolve, 150)));

type RenderSceneParams = {
  readonly name: keyof typeof U25_B_TERMINAL_DRAWER_SCENES;
};

const renderScene = ({ name }: RenderSceneParams) => {
  const Scene = U25_B_TERMINAL_DRAWER_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the terminal drawer scenes', () => {
  it('registers both scenes', () => {
    for (const [id, scene] of Object.entries(U25_B_TERMINAL_DRAWER_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(scene);
    }
  });

  it('opens the session terminal in a right drawer with its worktree and the page link', async () => {
    renderScene({ name: 'terminal-drawer-session' });
    await settle();

    const drawer = screen.getByRole('region', { name: 'payments-api-idempotency' });
    expect(
      within(drawer).getByText('payments-api-idempotency', { selector: 'span' }),
    ).toBeDefined();
    expect(within(drawer).getByRole('button', { name: 'Open on Terminal page' })).toBeDefined();
    expect(within(drawer).getByRole('button', { name: 'Close' })).toBeDefined();
    expect(within(drawer).getByTestId('terminal-panel').getAttribute('data-terminal')).toMatch(
      /::t1$/,
    );
  });

  it('keeps the tab in the list when the drawer closes', async () => {
    renderScene({ name: 'terminal-drawer-session' });
    await settle();
    const before = Object.values(store.getState().terminalTabs).flat().length;

    fireEvent.click(
      within(screen.getByRole('region', { name: 'payments-api-idempotency' })).getByRole('button', {
        name: 'Close',
      }),
    );

    expect(store.getState().drawer).toBeNull();
    expect(Object.values(store.getState().terminalTabs).flat()).toHaveLength(before);
  });

  it('moves the same tab to the Terminal page from the drawer', async () => {
    renderScene({ name: 'terminal-drawer-session' });
    await settle();
    const tabId = store.getState().drawer?.kind === 'terminal' ? store.getState().drawer : null;

    fireEvent.click(screen.getByRole('button', { name: 'Open on Terminal page' }));

    expect(store.getState().drawer).toBeNull();
    const studio = store.getState().appStudio;
    expect(studio?.kind).toBe('terminal');
    expect(studio?.kind === 'terminal' ? studio.terminalId : null).toBe(
      tabId?.kind === 'terminal' ? tabId.payload.terminalId : undefined,
    );
  });

  it('closes the drawer when its terminal exits and leaves the tab list', async () => {
    renderScene({ name: 'terminal-drawer-session' });
    await settle();
    const [first] =
      store.getState().terminalTabs[Object.keys(store.getState().terminalTabs)[0] ?? ''] ?? [];

    act(() => {
      if (first !== undefined) {
        store.getState().closeTerminalTab({ owner: first.owner, tabId: first.id });
      }
    });

    expect(store.getState().drawer).toBeNull();
  });

  it('lists session terminals on the Terminal page under a group named after the session', async () => {
    renderScene({ name: 'terminal-drawer-page' });
    await settle();

    const groups = screen.getAllByRole('region').map((group) => group.getAttribute('aria-label'));
    expect(groups).toEqual(['Workspace', 'Stop retried webhooks posting a second credit']);
    expect(
      within(
        screen.getByRole('region', { name: 'Stop retried webhooks posting a second credit' }),
      ).getAllByRole('listitem'),
    ).toHaveLength(2);
  });
});
