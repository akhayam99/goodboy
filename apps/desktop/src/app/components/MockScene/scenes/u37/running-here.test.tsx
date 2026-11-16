// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U37_RUNNING_HERE_SCENES } from './running-here';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
  vi.spyOn(document, 'hasFocus').mockImplementation(() => true);
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

type MountParams = {
  readonly id: keyof typeof U37_RUNNING_HERE_SCENES;
};

const mount = ({ id }: MountParams) => {
  const Scene = U37_RUNNING_HERE_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const ports = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-branch-ports]');

describe('the u37 running here scenes', () => {
  it('registers each scene', () => {
    for (const id of Object.keys(U37_RUNNING_HERE_SCENES)) {
      expect(MOCK_SCENES[id]).toBeDefined();
    }
  });

  it('puts the ports on the header meta line after the branch facts, and nothing under the tabs', async () => {
    mount({ id: 'u37-running-here' });

    await waitFor(() => expect(ports()).not.toBeNull());
    const meta = ports()?.closest('[data-slot="pane-meta"]');
    expect(meta?.closest('[data-page-header]')).not.toBeNull();
    const facts = meta?.querySelector('[data-branch-start-line], [data-pr-header-line]');
    const order = facts?.compareDocumentPosition(ports() ?? document.body) ?? 0;
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0);
    expect(document.querySelectorAll('[data-branch-ports]')).toHaveLength(1);
    expect(document.querySelector('[data-branch-running-line]')).toBeNull();
    expect(screen.queryByText('Running here')).toBeNull();
  });

  it('names the terminal port and the agent port of the branch', async () => {
    mount({ id: 'u37-running-here' });

    await waitFor(() => expect(ports()).not.toBeNull());
    const text = ports()?.textContent ?? '';
    expect(text).toContain(':4310');
    expect(text).toContain(':5173');
    expect(text).not.toContain(':4310:4310');
    const chips = screen.queryAllByRole('button', { name: /^Open localhost:\d+$/ });
    expect(chips.map((chip) => chip.getAttribute('aria-label'))).toEqual([
      'Open localhost:4310',
      'Open localhost:5173',
    ]);
    screen.getByRole('button', { name: 'Ports' });
  });

  it('shows two ports and folds the third into +1 more', async () => {
    mount({ id: 'u37-running-here-more' });

    await waitFor(() => expect(ports()).not.toBeNull());
    expect(screen.queryAllByRole('button', { name: /^Open localhost:\d+$/ })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Open localhost:6006' })).toBeNull();
    screen.getByRole('button', { name: '+1 more' });
  });

  it('opens Monitoring filtered to the branch', async () => {
    const openStudio = vi.fn();
    mount({ id: 'u37-running-here' });
    act(() => store.setState({ openStudio }));

    await waitFor(() => expect(ports()).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Ports' }));

    expect(openStudio).toHaveBeenCalledTimes(1);
    expect(openStudio.mock.calls[0]?.[0]).toMatchObject({
      studio: {
        kind: 'monitoring',
        target: { branch: 'hl/fix-duplicate-credit' },
      },
    });
  });

  it('shows no ports and no empty label when nothing runs on the branch', async () => {
    mount({ id: 'u37-running-here-idle' });

    await screen.findAllByRole('tab');
    await act(async () => undefined);

    expect(ports()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ports' })).toBeNull();
  });
});
