// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U31_CHAT_READING_SCENES } from './chat-reading';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const mount = () => {
  const Scene = U31_CHAT_READING_SCENES['u31-chat-reading'];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the chat reading scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U31_CHAT_READING_SCENES)).toEqual(['u31-chat-reading']);
    expect(MOCK_SCENES['u31-chat-reading']).toBe(U31_CHAT_READING_SCENES['u31-chat-reading']);
  });

  it('frames the capture on one element that holds the pane and nothing else', async () => {
    const { container } = mount();

    await screen.findByText('Fixed: one credit per retry', undefined, WAIT);
    const frames = container.querySelectorAll<HTMLElement>('[data-shot]');
    expect(frames).toHaveLength(1);
    expect(frames[0]?.children).toHaveLength(1);
    expect(within(frames[0] ?? container).getAllByTestId('outcome-line')).toHaveLength(3);
  });

  it('opens a turn at each message of the person, with the outcome of each answer as a heading', async () => {
    const { container } = mount();

    await screen.findByText('Fixed: one credit per retry', undefined, WAIT);
    expect(container.querySelectorAll('[data-turn]')).toHaveLength(3);
    expect(screen.getAllByTestId('outcome-line').map((line) => line.textContent)).toEqual([
      'Planning first, because the change touches ledger code',
      'Plan v1 approved, the Implementer is starting',
      'Fixed: one credit per retry',
    ]);
  });

  it('shows the delegated cards and the tool groups of the exchange between the messages', async () => {
    mount();

    expect(
      (await screen.findAllByRole('list', { name: 'Delegations' }, WAIT)).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Read 4 files/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/edited 3 files/i).length).toBeGreaterThan(0);
  });

  it('clamps the long answer at 12 lines behind Show more and opens it whole', async () => {
    const { container } = mount();

    await screen.findByText('Fixed: one credit per retry', undefined, WAIT);
    expect(container.querySelectorAll('[data-clamped="true"]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(container.querySelectorAll('[data-clamped="true"]')).toHaveLength(0);
    screen.getByRole('button', { name: 'Show less' });
  });

  it('gives each answer one Copy that takes no row of its own', async () => {
    const { container } = mount();

    await screen.findByText('Fixed: one credit per retry', undefined, WAIT);
    const metas = [...container.querySelectorAll<HTMLElement>('[data-message-meta]')];
    expect(metas).toHaveLength(3);
    for (const meta of metas) {
      expect(within(meta).getAllByRole('button')).toHaveLength(1);
      expect(meta.nextElementSibling).toBeNull();
    }
  });
});
