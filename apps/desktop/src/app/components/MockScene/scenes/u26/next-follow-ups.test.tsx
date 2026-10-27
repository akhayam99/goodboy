// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U26_NEXT_FOLLOW_UPS_SCENES } from './next-follow-ups';

beforeAll(async () => {
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
});

type Params = { readonly name: string };
const show = ({ name }: Params) => {
  const Scene = U26_NEXT_FOLLOW_UPS_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown next follow-ups scene');
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const needsYou = (): HTMLElement => screen.getByRole('region', { name: 'Needs you' });

describe('next follow-ups scenes', () => {
  it('offers Start fix once, on the Fix row of Needs you, once the analyze run proposed a fix', () => {
    show({ name: 'overview-after-analyze-light' });
    expect(screen.getAllByRole('button', { name: 'Start fix' })).toHaveLength(1);
    expect(within(needsYou()).getAllByRole('button', { name: 'Start fix' })).toHaveLength(1);
    expect(
      within(screen.getByRole('region', { name: 'Running' })).getAllByRole('button', {
        name: 'Open CI fix · payments-api / test · #318',
      }).length,
    ).toBeGreaterThan(0);
  });
  it('offers Push once, on the Fix row of Needs you, once the fix committed on the branch', () => {
    show({ name: 'overview-after-fix-dark' });
    expect(screen.getAllByRole('button', { name: 'Push' })).toHaveLength(1);
    expect(within(needsYou()).getAllByRole('button', { name: 'Push' })).toHaveLength(1);
  });
  it('registers a light and a dark shot for each moment', () => {
    expect(Object.keys(U26_NEXT_FOLLOW_UPS_SCENES)).toEqual([
      'overview-after-analyze-light',
      'overview-after-analyze-dark',
      'overview-after-fix-light',
      'overview-after-fix-dark',
    ]);
  });
  it.each(Object.keys(U26_NEXT_FOLLOW_UPS_SCENES))(
    '%s has no accessibility violations',
    async (name) => {
      const { container } = show({ name });
      const { violations } = await runA11yCheck(container);
      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
