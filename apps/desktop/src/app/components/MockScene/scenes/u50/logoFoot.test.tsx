// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U50_LOGO_FOOT_SCENES } from './logoFoot';

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  window.localStorage.clear();
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
  applyDocumentTheme({ theme: 'dark' });
});

type SceneParams = {
  readonly name: string;
};

const footOf = async ({ name }: SceneParams): Promise<ReadonlyArray<string>> => {
  const Scene = U50_LOGO_FOOT_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`No scene ${name}`);
  }
  render(<Scene />);
  const rail = await screen.findByRole('navigation', { name: 'Places' });
  within(rail).getByRole('button', { name: 'Settings' });
  return Array.from(
    rail.querySelectorAll('[data-shell-rail-item], [data-rail-signature]'),
    (item) => item.getAttribute('data-shell-rail-item') ?? 'signature',
  ).slice(-4);
};

describe('the u50 logo foot scenes', () => {
  it('lists the rail foot at rest and with an update, in light and dark', () => {
    expect(Object.keys(U50_LOGO_FOOT_SCENES)).toEqual([
      'u50-logo-foot-light',
      'u50-logo-foot-dark',
      'u50-logo-foot-update-light',
      'u50-logo-foot-update-dark',
    ]);
  });

  it.each(['u50-logo-foot-light', 'u50-logo-foot-dark'])(
    '%s closes the rail with Settings, Report and the signature',
    async (name) => {
      expect(await footOf({ name })).toEqual(['impact', 'settings', 'report', 'signature']);
    },
  );

  it.each(['u50-logo-foot-update-light', 'u50-logo-foot-update-dark'])(
    '%s puts Update above the signature and keeps it',
    async (name) => {
      expect(await footOf({ name })).toEqual(['settings', 'report', 'update', 'signature']);
    },
  );
});
