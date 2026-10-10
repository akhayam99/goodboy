// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U24_RESOLVER_SCENES } from './resolver';

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
  const Scene = U24_RESOLVER_SCENES[name];
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

describe('the resolver scenes', () => {
  it('registers both scenes for the capture', () => {
    expect(Object.keys(U24_RESOLVER_SCENES).sort()).toEqual([
      'models-anthropic-on',
      'models-codex-only',
    ]);
    expect(MOCK_SCENES['models-codex-only']).toBe(U24_RESOLVER_SCENES['models-codex-only']);
  });

  it('models-codex-only says why each Claude pin is skipped', async () => {
    await mount('models-codex-only');

    expect(screen.getAllByText(/^Pinned Opus 5\.5 is skipped: Claude is Off\. Using /).length).toBe(
      4,
    );
    expect(screen.getAllByText(/^Pinned Sonnet 5 is skipped: Claude is Off\. Using /).length).toBe(
      1,
    );
    expect(screen.queryByText(/A project setting/)).toBeNull();
  });

  it('models-anthropic-on runs the pins and prints no project line', async () => {
    await mount('models-anthropic-on');

    expect(screen.queryByText(/is skipped/)).toBeNull();
    expect(screen.queryByText(/A project setting/)).toBeNull();
    const summaries = Array.from(
      document.querySelectorAll<HTMLElement>('[data-role-summary]'),
    ).filter((summary) => summary.textContent === 'Opus 5.5·High');
    expect(summaries.length).toBe(4);
  });

  it.each(Object.keys(U24_RESOLVER_SCENES))(
    '%s has no accessibility violation once drawn',
    async (name) => {
      const container = await mount(name);
      vi.useRealTimers();

      const { violations } = await runA11yCheck(container);

      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
