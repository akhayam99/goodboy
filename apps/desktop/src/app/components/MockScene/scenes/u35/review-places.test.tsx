// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { U35_REVIEW_PLACE_SCENES } from './review-places';

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
  const Scene = U35_REVIEW_PLACE_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u35 review place scenes', () => {
  it('registers each scene', () => {
    for (const [name, Scene] of Object.entries(U35_REVIEW_PLACE_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(Scene);
    }
  });

  it('u35-agent-chain-sub-sub goes back to the sub agent, then to the main agent', async () => {
    mount({ id: 'u35-agent-chain-sub-sub' });

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Back to Read retry state from the typed endpoint',
      }),
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Back to Add the stuck-delivery banner' }),
    );
    await screen.findByRole('button', { name: 'Back to runs' });
  });

  it('u35-branch-setup-offer draws the setup offer inside the Branch page', async () => {
    mount({ id: 'u35-branch-setup-offer' });

    await screen.findByText(/is ready\./);
    await waitFor(() => {
      screen.getByRole('button', { name: 'Back to overview' });
    });
  });
});
