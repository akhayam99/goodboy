// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import { installBackends } from '../../../../../installBackends';
import { mockRuntime } from '../../../installMockRuntime';
import { MOCK_SCENES } from '../../..';
import { DIFF_THREADS_SCENES } from './diff-threads';
import { HOST_THREAD_IDS } from './hostThreadsSeed';

const WAIT = { timeout: 20_000 };

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  installBackends(mockRuntime());
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

const threadCard = ({ id }: { readonly id: string }): HTMLElement => {
  const card = document.querySelector<HTMLElement>(`article[data-thread-id="review:${id}"]`);
  if (card === null) {
    throw new Error(`the thread ${id} is not drawn`);
  }
  return card;
};

describe('the diff threads scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(DIFF_THREADS_SCENES)).toEqual(['diff-threads']);
    expect(MOCK_SCENES['diff-threads']).toBe(DIFF_THREADS_SCENES['diff-threads']);
  });

  it('shows the reviewer threads in the diff with their state', async () => {
    const Scene = DIFF_THREADS_SCENES['diff-threads'];
    render(<Scene />);

    await screen.findByText(/Return the existing credit here/, undefined, WAIT);

    const open = threadCard({ id: HOST_THREAD_IDS.open });
    within(open).getByText('Open');
    within(open).getByText('1 reply');
    const resolved = threadCard({ id: HOST_THREAD_IDS.resolved });
    expect(resolved.getAttribute('data-thread-state')).toBe('resolved');
    within(resolved).getByText('Resolved');
  });

  it('shows a thread whose line left the diff as outdated at the top of its file', async () => {
    const Scene = DIFF_THREADS_SCENES['diff-threads'];
    render(<Scene />);

    await screen.findByText(/Can this helper live next to the ledger client/, undefined, WAIT);

    const gone = threadCard({ id: HOST_THREAD_IDS.gone });
    within(gone).getByText('Outdated');
    expect(gone.closest('[data-slot="diff-file-body"]')?.firstElementChild?.contains(gone)).toBe(
      true,
    );
  });

  it('shows a thread the host marks outdated above the first line of its file', async () => {
    const Scene = DIFF_THREADS_SCENES['diff-threads'];
    render(<Scene />);

    await screen.findByText(/This branch of the guard reads the old counter/, undefined, WAIT);

    const outdated = threadCard({ id: HOST_THREAD_IDS.outdated });
    within(outdated).getByText('Outdated');
  });
});
