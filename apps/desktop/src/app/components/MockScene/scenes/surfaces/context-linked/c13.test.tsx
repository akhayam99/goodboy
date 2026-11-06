// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { importStore, resetStoryStore, storySpies } from '../../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../../test/sceneInvoke';
import { U36_CONTEXT_LINKED_SCENES } from './c13';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

beforeAll(async () => {
  await importStore();
});
beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('Expected a command name');
    }
    return sceneInvoke({ command, args });
  });
});
afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

describe.each(['light', 'dark'])('u36 Context and linked work in %s', (theme) => {
  it.each(Object.entries(U36_CONTEXT_LINKED_SCENES))(
    'mounts %s with the production surface',
    async (name, Scene) => {
      document.documentElement.dataset.theme = theme;
      render(
        <ToastProvider>
          <Scene />
        </ToastProvider>,
      );
      if (name.startsWith('u36-p19-')) {
        const drawer = await screen.findByRole('region', { name: 'Context' });
        within(drawer).getByRole('heading', { name: 'Goal' });
        within(drawer).getByRole('region', { name: 'State' });
        if (name === 'u36-p19-read') {
          expect(within(drawer).queryByText('Added')).toBeNull();
        }
        if (name === 'u36-p19-menu') {
          const menu = await screen.findByRole('menu', { name: 'Decisions actions' });
          expect(within(menu).getAllByRole('menuitem')).toHaveLength(3);
        }
        return;
      }
      if (name === 'u36-p19b-questions-waiting') {
        const list = await screen.findByRole('list', { name: 'Questions' });
        const first = within(list).getAllByRole('button')[0];
        expect(document.activeElement).toBe(first);
        expect(first?.getAttribute('aria-label')).toContain(' · ');
        return;
      }
      if (name === 'u36-p19b-questions-answered') {
        const list = await screen.findByRole('list', { name: 'Questions' });
        expect(within(list).queryAllByRole('button', { name: /^(Hide|Show)$/ })).toHaveLength(1);
        fireEvent.click(within(list).getByRole('button', { name: 'Show' }));
        expect(within(list).getAllByRole('button').length).toBeGreaterThan(1);
        return;
      }
      if (name === 'u36-p19b-disconnected') {
        await screen.findByText(
          'Connection lost. Open the record in its provider or reconnect in Settings.',
        );
        screen.getByRole('button', { name: 'More actions for HBL-142' });
        screen.getByRole('button', { name: 'Back to overview' });
        return;
      }
      const linked = await screen.findByRole('list', { name: 'Linked work' });
      within(linked).getByRole('button', { name: 'Open PAYMENTS-42 in Tasks' });
      within(linked).getByRole('button', { name: 'Open HBL-97 on hl/surface-retry-state' });
      expect(screen.queryByText('Confirm the earlier retry rollout')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Show history (1)' }));
      screen.getByText('Confirm the earlier retry rollout');
      fireEvent.click(screen.getByRole('button', { name: 'Hide history (1)' }));
      expect(screen.queryByText('Confirm the earlier retry rollout')).toBeNull();
    },
  );
});
