// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import {
  importStore,
  resetStoryStore,
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
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
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
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Back to runs' })).toBeDefined();
    });
  });

  it('u35-branch-setup-offer draws the setup offer inside the Branch page', async () => {
    mount({ id: 'u35-branch-setup-offer' });

    expect(await screen.findByText(/is ready\./)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Back to overview' })).toBeDefined();
  });
});
