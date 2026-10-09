// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
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
import { MOCK_SCENES } from '../../index';
import { U23_TOPBAR_SCENES } from './topbar';

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
});

const SCENE_IDS = [
  'topbar-states',
  'topbar-1100',
  'topbar-limits-overflow',
  'palette-stable-height',
  'palette-stable-height-typing',
  'chat-list-idle',
  'impact-stat-cards',
  'storage-other-tools',
  'workspace-switcher-single',
] as const;

const renderScene = async (id: string) => {
  const Scene = (MOCK_SCENES as Record<string, (typeof U23_TOPBAR_SCENES)[string]>)[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  const view = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
  return view;
};

describe('the u23 top bar scenes', () => {
  it('registers exactly the scenes the plan names', () => {
    expect(Object.keys(U23_TOPBAR_SCENES).sort()).toEqual([...SCENE_IDS].sort());
  });

  it('draws Now, Limits, Spend and the bell with no Impact icon and no theme toggle', async () => {
    await renderScene('topbar-states');

    const bar = document.querySelector('[data-top-bar]') as HTMLElement;
    expect(within(bar).getByRole('button', { name: /need/ })).toBeDefined();
    expect(within(bar).getByRole('toolbar', { name: 'Provider limits' })).toBeDefined();
    expect(within(bar).getByRole('button', { name: 'Spend today. Open Impact' })).toBeDefined();
    expect(within(bar).queryByRole('button', { name: 'Impact' })).toBeNull();
    expect(within(bar).queryByRole('button', { name: /Switch to (light|dark)/ })).toBeNull();
    expect(within(bar).getByRole('button', { name: /^Search \(/ })).toBeDefined();
  });

  it('words the Limits overflow as +N providers', async () => {
    await renderScene('topbar-limits-overflow');

    const overflow = screen
      .getAllByRole('button', { name: /more providers?$/ })
      .map((chip) => chip.textContent);
    expect(overflow.length).toBeGreaterThan(0);
    for (const text of overflow) {
      expect(text).toMatch(/^\+\d+ providers?$/);
    }
  });

  it.each(['palette-stable-height', 'palette-stable-height-typing'])(
    'keeps the %s window on one 480 minimum height',
    async (id) => {
      await renderScene(id);

      const dialog = screen.getByRole('dialog');
      expect(dialog.style.minHeight).toBe('480px');
    },
  );

  it('shows no empty row under the only workspace', async () => {
    await renderScene('workspace-switcher-single');

    expect(screen.queryByText(/No workspaces/)).toBeNull();
    expect(screen.queryByText(/No other workspaces/)).toBeNull();
    expect(screen.getByText('Harborline')).toBeDefined();
  });

  it('keeps the chat list free of resting trash icons', async () => {
    await renderScene('chat-list-idle');

    expect(screen.queryAllByRole('button', { name: /^Delete / })).toEqual([]);
  });
});
