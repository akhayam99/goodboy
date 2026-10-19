// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/slices/worktreeStatuses/cache';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U26_CENTRAL_SCENES } from './central';

const KINDS = ['mid', 'finished', 'stuck', 'orchestrated', 'agent', 'branches'] as const;

const KEYS = [
  ...KINDS.flatMap((kind) => [`u26-central-${kind}-light`, `u26-central-${kind}-dark`]),
  'u26-central-log-light',
  'u26-central-log-dark',
];

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
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

type Params = { readonly name: string };

const show = async ({ name }: Params) => {
  const Scene = U26_CENTRAL_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown central scene');
  }
  const view = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return view;
};

describe('the central column scenes', () => {
  it('registers every scene key', () => {
    expect(Object.keys(U26_CENTRAL_SCENES)).toEqual(KEYS);
  });

  it('draws the Log drawer over the column', async () => {
    await show({ name: 'u26-central-log-light' });

    screen.getByRole('region', { name: 'Log' });
    screen.getByRole('region', { name: 'Now' });
  });

  it('draws the Now, Next and What was done sections on the mid scene', async () => {
    await show({ name: 'u26-central-mid-light' });

    for (const name of ['Now', 'Next steps', 'What was done']) {
      screen.getByRole('region', { name });
    }
  });

  it.each(KEYS)('%s has no accessibility violations', async (name) => {
    const { container } = await show({ name });
    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
