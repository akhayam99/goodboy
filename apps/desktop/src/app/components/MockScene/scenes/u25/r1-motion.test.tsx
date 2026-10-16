// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_R1_MOTION_SCENES } from './r1-motion';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U25_R1_MOTION_SCENES;

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
});

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U25_R1_MOTION_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

const sidebarToggle = (): HTMLElement => {
  const toggle = document.querySelector<HTMLElement>('aside [data-sidebar-toggle]');
  if (toggle === null) {
    throw new Error('no sidebar toggle');
  }
  return toggle;
};

describe('the r1 motion scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U25_R1_MOTION_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('r1-motion-shell-open opens the sidebar and the session rail, and its sidebar toggle folds', async () => {
    await mount('r1-motion-shell-open');

    expect(document.querySelector('[data-column-layer="nav"]')).not.toBeNull();
    expect(document.querySelector('[data-session-rail]')?.hasAttribute('data-rail-folded')).toBe(
      false,
    );

    fireEvent.click(sidebarToggle());

    expect(document.querySelector('[data-column-rail]')).not.toBeNull();
    expect(document.querySelector('[data-column-layer="nav"]')).toBeNull();
  });

  it('r1-motion-shell-folded folds both rails to their icons, and its sidebar toggle opens', async () => {
    await mount('r1-motion-shell-folded');

    expect(document.querySelector('[data-column-rail]')).not.toBeNull();
    expect(document.querySelector('[data-session-rail]')?.hasAttribute('data-rail-folded')).toBe(
      true,
    );

    fireEvent.click(sidebarToggle());

    expect(document.querySelector('[data-column-layer="nav"]')).not.toBeNull();
  });
});
