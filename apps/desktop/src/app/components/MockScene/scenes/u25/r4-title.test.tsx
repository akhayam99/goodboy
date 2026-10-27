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
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { MOCK_SCENES } from '../..';
import { U25_R4_TITLE_SCENES } from './r4-title';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U25_R4_TITLE_SCENES;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
  resetWorktreeStatusCache();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U25_R4_TITLE_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const field = (): HTMLInputElement =>
  screen.getByRole<HTMLInputElement>('textbox', { name: 'Session title' });

const ring = (): HTMLElement => screen.getByRole('img', { name: /of 120 characters$/ });

describe('the r4 title scenes', () => {
  it('registers every scene with the mock scene registry', () => {
    for (const name of Object.keys(U25_R4_TITLE_SCENES)) {
      expect(MOCK_SCENES[name]).toBeDefined();
    }
  });

  it('r4-title-edit opens the Overview title as the full row field with a calm ring', async () => {
    await mount('r4-title-edit');

    expect(field().closest('h1')).not.toBeNull();
    expect(field().closest('[data-title-field]')?.getAttribute('data-title-field')).toBe('title');
    expect(ring().getAttribute('aria-label')).toBe(`${field().value.length} of 120 characters`);
    expect(ring().hasAttribute('data-near-limit')).toBe(false);
  });

  it('r4-title-edit-near-limit keeps the linked key outside the field and warns near 120', async () => {
    await mount('r4-title-edit-near-limit');

    const host = field().closest('[data-title-field]');
    expect(host?.querySelector('[data-session-key]')?.textContent).toBe('HBL-391');
    expect(field().value.startsWith('[')).toBe(false);
    expect(ring().getAttribute('aria-label')).toBe(
      `${'[HBL-391] '.length + field().value.length} of 120 characters`,
    );
    expect(ring().hasAttribute('data-near-limit')).toBe(true);
  });

  it('r4-title-row-edit renames a sidebar row in the compact field with the same ring', async () => {
    await mount('r4-title-row-edit');

    expect(field().closest('h1')).toBeNull();
    expect(field().closest('[data-title-field]')?.getAttribute('data-title-field')).toBe('row');
    expect(field().value).toBe('Retry failed card payments on a dunning schedule');
    expect(ring().getAttribute('aria-label')).toBe('48 of 120 characters');
  });
});
