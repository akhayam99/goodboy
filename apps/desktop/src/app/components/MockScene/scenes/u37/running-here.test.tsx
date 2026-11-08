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

const runningLine = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-branch-running-line]');

describe('the u37 running here scenes', () => {
  it('registers each scene', () => {
    for (const id of Object.keys(U37_RUNNING_HERE_SCENES)) {
      expect(MOCK_SCENES[id]).toBeDefined();
    }
  });

  it('puts the line in the header, above the tab strip', async () => {
    mount({ id: 'u37-running-here' });

    await waitFor(() => expect(runningLine()).not.toBeNull());
    const tabs = screen.getAllByRole('tab')[0];
    const position = runningLine()?.compareDocumentPosition(tabs ?? document.body) ?? 0;
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0);
  });

  it('names the terminal port and the agent port of the branch', async () => {
    mount({ id: 'u37-running-here' });

    await waitFor(() => expect(runningLine()).not.toBeNull());
    const line = runningLine();
    expect(line?.textContent).toContain(':5173');
    expect(line?.textContent).toContain(':4310');
    expect(line?.textContent).not.toContain(':4310:4310');
    expect(line?.textContent).toContain('Terminal');
    expect(line?.textContent).toContain('Agent');
  });

  it('opens Monitoring filtered to the branch', async () => {
    const openStudio = vi.fn();
    mount({ id: 'u37-running-here' });
    act(() => store.setState({ openStudio }));

    await waitFor(() => expect(runningLine()).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /^Open :5173 .* in Monitoring$/ }));

    expect(openStudio).toHaveBeenCalledTimes(1);
    expect(openStudio.mock.calls[0]?.[0]).toMatchObject({
      studio: {
        kind: 'monitoring',
        target: { branch: 'hl/fix-duplicate-credit' },
      },
    });
  });

  it('shows no line when nothing runs on the branch', async () => {
    mount({ id: 'u37-running-here-idle' });

    await screen.findAllByRole('tab');
    await act(async () => undefined);

    expect(runningLine()).toBeNull();
  });
});
