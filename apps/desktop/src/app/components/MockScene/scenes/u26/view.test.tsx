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
import { MOCK_SCENES } from '../..';
import { U26_VIEW_SCENES } from './view';

const COLUMN_KEYS = [
  'u26-view-new-light',
  'u26-view-new-dark',
  'u26-view-archived-light',
  'u26-view-archived-dark',
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

afterEach(cleanup);

type Params = {
  readonly name: string;
  readonly registry?: Readonly<Record<string, React.ComponentType>>;
};

const show = async ({ name, registry = U26_VIEW_SCENES }: Params) => {
  const Scene = registry[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
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

describe('the view switch scenes', () => {
  it('registers every scene for the capture', () => {
    for (const [id, Scene] of Object.entries(U26_VIEW_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('draws the cards with no overview toggle beside New', async () => {
    await show({ name: 'u26-view-new-light' });

    expect(screen.getByRole('button', { name: 'New' })).toBeDefined();
    expect(screen.queryByRole('tablist', { name: 'Overview' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Activity' })).toBeNull();
    expect(document.querySelector('[data-central-column]')).not.toBeNull();
  });

  it('keeps Restore and no toggle on an archived session', async () => {
    await show({ name: 'u26-view-archived-light' });

    expect(screen.queryByRole('button', { name: 'New' })).toBeNull();
    expect(screen.getByRole('button', { name: /Restore/ })).toBeDefined();
    expect(screen.queryByRole('tablist', { name: 'Overview' })).toBeNull();
  });

  it.each(COLUMN_KEYS)('%s has no accessibility violations', async (name) => {
    const { container } = await show({ name });
    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
