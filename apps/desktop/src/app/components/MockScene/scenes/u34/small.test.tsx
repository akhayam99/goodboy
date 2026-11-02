// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { U34_SMALL_SCENES } from './small';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

beforeAll(async () => {
  installFakeResizeObserver();
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

type MountParams = { readonly name: keyof typeof U34_SMALL_SCENES };
const mount = ({ name }: MountParams) => {
  const Scene = U34_SMALL_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the small flows scenes', () => {
  it('keeps one question on Needs you and no needs-you label on Done', async () => {
    mount({ name: 'u34-u5-question' });
    const done = await screen.findByRole('region', { name: 'Done' });
    const state = (await importStore()).getState();
    expect(Object.values(state.sessionOpenQuestions).flat()).toHaveLength(1);
    expect(done.textContent).not.toMatch(/needs? you/);
    const needsYou = screen.getByRole('region', { name: 'Needs you' });
    expect(within(needsYou).getAllByRole('button', { name: 'Answer' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Answer' })).toHaveLength(1);
    fireEvent.click(within(needsYou).getByRole('button', { name: 'See result' }));
    expect(done.contains(document.activeElement)).toBe(true);
  });

  it('mounts the branch header with commit wording', async () => {
    const { container } = mount({ name: 'u34-u35-unpushed' });
    await waitFor(() => expect(container.querySelector('[data-branch-start-line]')).not.toBeNull());
    expect(container.textContent).not.toMatch(/Push \d+ fixes/);
  });

  it('keeps request numbers in the branch rows', async () => {
    const { container } = mount({ name: 'u34-u33-branches' });
    await waitFor(() => expect(container.querySelector('[data-worktree-branch]')).not.toBeNull());
    expect(container.querySelectorAll('[data-worktree-branch]').length).toBeGreaterThan(1);
    expect(screen.queryByRole('button', { name: /^Open rebase of/ })).toBeNull();
  });

  it('starts the step trail after the session while the column is open', async () => {
    mount({ name: 'u34-u56-step' });
    const trail = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    const labels = [...trail.querySelectorAll('[data-trail-piece]')].map(
      (piece) => piece.textContent,
    );
    expect(labels[0]).toBe('Runs');
    expect(labels.at(-1)).not.toBe('Agent');
  });

  it('offers provider recovery above Retry', () => {
    mount({ name: 'u34-u12-provider' });
    const open = vi.fn();
    window.addEventListener('goodboy:open-settings', open, { once: true });
    const alert = screen.getByRole('alert');
    fireEvent.click(within(alert).getByRole('button', { name: 'Connect a provider' }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(
      alert.compareDocumentPosition(screen.getByRole('button', { name: 'Retry' })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
  });

  it('copies the details of another start failure', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    mount({ name: 'u34-u12-failure' });
    fireEvent.click(screen.getByRole('button', { name: 'Copy details' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('The payments-api project could not be opened.'),
    );
  });
});
