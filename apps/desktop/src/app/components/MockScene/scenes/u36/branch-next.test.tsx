// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U36_BRANCH_NEXT_SCENES } from './branch-next';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
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
});

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams) => {
  const Scene = U36_BRANCH_NEXT_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const headerStep = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-branch-primary]');

describe('the u36 branch next step scenes', () => {
  it('registers each scene', () => {
    for (const id of Object.keys(U36_BRANCH_NEXT_SCENES)) {
      expect(MOCK_SCENES[id]).toBeDefined();
    }
  });

  it('leads with Fix checks while a check fails and nothing runs', async () => {
    mount({ id: 'u36-p16-fix-checks' });

    await waitFor(() => expect(headerStep()?.textContent).toBe('Fix checks'));
    expect(screen.queryByTestId('branch-check-work')).toBeNull();
  });

  it('draws no fill and one line with Stop while the Debugger works', async () => {
    mount({ id: 'u36-p16-checks-working' });

    const line = await screen.findByTestId('branch-check-work');
    expect(line.textContent).toMatch(/^Analyzing /);
    screen.getByRole('button', { name: 'Stop' });
    expect(headerStep()).toBeNull();
  });

  it('moves on to Start fix once the Debugger proposed one', async () => {
    mount({ id: 'u36-p16-start-fix' });

    await waitFor(() => expect(headerStep()?.textContent).toBe('Start fix'));
  });
});
