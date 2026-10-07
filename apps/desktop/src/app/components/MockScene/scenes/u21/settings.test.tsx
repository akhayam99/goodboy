// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U21_SETTINGS_SCENES } from './settings';

const SETTLE_MS = 2_000;

beforeAll(async () => {
  await importStore();
  await import('../../../../../features/settings/components/SettingsStudio');
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: string): Promise<Element> => {
  const Scene = U21_SETTINGS_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
  }
  const { container } = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

describe('the Settings scenes', () => {
  it('keeps one scene for the General page of the default shell', () => {
    const names = Object.keys(U21_SETTINGS_SCENES).sort();

    expect(names).toEqual([
      'settings-general-legacy',
      'settings-general-pinned',
      'settings-providers-rail',
    ]);
    expect(names).not.toContain('settings-general-rail');
  });

  it('settings-general-pinned shows the column on the chrome with Back to app and the page as one sheet', async () => {
    await mount('settings-general-pinned');

    expect(screen.getByRole('button', { name: /^Back to app/ })).toBeDefined();
    expect(document.querySelector('[data-column-rail]')).toBeNull();
    expect(document.querySelector('[data-studio-band]')).toBeNull();
    expect(document.querySelector('[data-studio-rail]')).toBeNull();
    expect(screen.getByRole('heading', { name: 'General' })).toBeDefined();
    expect(screen.getAllByRole('navigation', { name: 'Settings scopes' })).toHaveLength(1);
  });

  it('settings-providers-rail shows the dot in the nav and the notice on the Claude page', async () => {
    await mount('settings-providers-rail');

    expect(screen.getByRole('button', { name: /^Back to app/ })).toBeDefined();
    const list = screen.getByRole('list', { name: 'Providers & models settings' });
    expect(
      within(within(list).getByRole('button', { name: /^Claude/ })).getByRole('img', {
        name: 'Claude is about to run out',
      }),
    ).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Claude' })).toBeDefined();
    expect(screen.getByText('Claude is about to run out.')).toBeDefined();
  });

  it('settings-general-legacy keeps the covering studio with its band, trail and rail', async () => {
    await mount('settings-general-legacy');

    expect(screen.getByRole('button', { name: 'Close settings' })).toBeDefined();
    expect(document.querySelector('[data-studio-band]')).not.toBeNull();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeDefined();
    expect(document.querySelector('[data-studio-rail]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /^Back to app/ })).toBeNull();
  });

  it.each(Object.keys(U21_SETTINGS_SCENES))(
    '%s has no accessibility violation once drawn',
    async (name) => {
      const container = await mount(name);
      vi.useRealTimers();

      const { violations } = await runA11yCheck(container);

      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
