// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { importStore, resetStoryStore, storySpies } from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
import { autoSceneOf } from '../u24/autoSceneSeed';
import { U36_P11_CHAT_SCENES } from './p11-chat';

type MountParams = { readonly id: string };
const mount = ({ id }: MountParams) => {
  const Scene = MOCK_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`Missing scene ${id}`);
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

beforeAll(async () => {
  await importStore();
  installFakeResizeObserver();
});
beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('A scene command must be a string');
    }
    return sceneInvoke({ command, args });
  });
});
afterEach(() => {
  cleanup();
  clearSceneInvoke();
  localStorage.clear();
});

describe('a chat you can scan', () => {
  it('registers all scenes and gives the final answer its own delivered reply', () => {
    for (const [id, Scene] of Object.entries(U36_P11_CHAT_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
    const { events } = autoSceneOf({ state: 'done' });
    const last = events.at(-1);
    const delivery = events.at(-2);
    expect(last?.kind).toBe('assistant_text');
    expect(delivery).toMatchObject({ kind: 'user_text', deliveredBy: 'auto', runId: last?.runId });
    expect(last?.runId).not.toBe(events.at(-3)?.runId);
  });
  it.each(['dark', 'light'])(
    'orders the done %s scene as cards, delivery, final answer',
    async (theme) => {
      const { container } = mount({ id: `u36-p11-done-${theme}` });
      const answer = await screen.findByText(/^Fixed\. The retry loop/);
      const review = screen.getByRole('group', { name: 'Review' });
      const deliveries = screen.getAllByRole('button', { name: /What Auto was told/ });
      const delivery = deliveries.at(-1);
      if (delivery === undefined) {
        throw new Error('The final delivery is missing');
      }
      expect(review.compareDocumentPosition(delivery) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
        0,
      );
      expect(delivery.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
        0,
      );
      screen.getByRole('group', { name: 'Plan' });
      screen.getByRole('group', { name: 'Build' });
      expect(screen.queryByText('Open')).toBeNull();
      expect(document.documentElement.classList.contains('dark')).toBe(theme === 'dark');
      const { violations } = await runA11yCheck(container);
      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
  it.each(['dark', 'light'])(
    'keeps one Retry and a quiet failure in the %s scene',
    async (theme) => {
      mount({ id: `u36-p11-failed-${theme}` });
      const retry = await screen.findByRole('button', { name: 'Retry' });
      expect(retry.closest('[data-conversation-dock]')).not.toBeNull();
      expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1);
      screen.getByRole('button', { name: 'Failed here' });
    },
  );
  it.each(['dark', 'light'])('shows live rows in the %s scene', async (theme) => {
    mount({ id: `u36-p11-working-${theme}` });
    const build = await screen.findByRole('group', { name: 'Build' });
    within(build).getByText('Running');
    screen.getByRole('button', { name: 'Read full brief' });
  });
  it.each(['u36-p12-step-page', 'u36-p12-orch-step-page'])(
    'renames the step from the %s menu',
    async (id) => {
      mount({ id });
      fireEvent.click(await screen.findByRole('button', { name: 'Step actions' }));
      const items = screen.getAllByRole('menuitem');
      expect(items.length).toBeLessThanOrEqual(5);
      fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
      await screen.findByRole('textbox', { name: 'Rename agent' });
    },
  );
});
