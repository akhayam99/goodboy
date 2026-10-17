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
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_R4_BRAND_SCENES } from './r4-brand';

const SETTLE_MS = 2_000;

const NAMES = ['r4-brand-dark', 'r4-brand-light'] as const;

type SceneName = (typeof NAMES)[number];

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
  applyDocumentTheme({ theme: 'dark' });
});

type MountParams = {
  readonly name: SceneName;
};

const mount = async ({ name }: MountParams): Promise<Element> => {
  const Scene = U25_R4_BRAND_SCENES[name];
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

describe('the brand lockup scenes', () => {
  it('registers every scene for the capture', () => {
    for (const name of NAMES) {
      expect(MOCK_SCENES[name]).toBe(U25_R4_BRAND_SCENES[name]);
    }
  });

  it.each(NAMES)('%s chips only the mark and the name, in the foot and the menu', async (name) => {
    await mount({ name });

    const chips = Array.from(document.querySelectorAll('[data-brand-chip]'));
    expect(chips).toHaveLength(2);
    expect(chips.map((chip) => chip.textContent)).toEqual(['Goodboy', 'Goodboy']);
    const menu = screen.getByRole('dialog', { name: 'Goodboy' });
    expect(menu.querySelector('header [data-brand-chip]')).not.toBeNull();
  });

  it.each(NAMES)('%s has no accessibility violation', async (name) => {
    const container = await mount({ name });
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
