// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../shared/components/Toast';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import { MockScene } from './index';
import { MOCK_SCENES } from './registry';
import { buildSceneRegistry } from './registry/buildSceneRegistry';

const LIST_PATH = join(__dirname, 'scenes.txt');

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  const logError = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args: ReadonlyArray<unknown>) => {
    if (args.map(String).join(' ').includes('fetch failed: Authorization')) {
      return;
    }
    logError(...args);
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('scene registry', () => {
  it('keeps a sorted, unique lowercase kebab-case list', () => {
    const ids = Object.keys(MOCK_SCENES).sort();
    expect(ids.every((id) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))).toBe(true);
    const list = `${ids.join('\n')}\n`;
    if (process.env.GOODBOY_UPDATE_BASELINE === '1') {
      writeFileSync(LIST_PATH, list);
    }
    expect(readFileSync(LIST_PATH, 'utf8')).toBe(list);
  });

  it('reports both files when an id is registered twice', () => {
    const Scene = () => <p>Harborline</p>;
    expect(() =>
      buildSceneRegistry({
        modules: {
          'one.tsx': { ONE_SCENES: { harborline: Scene } },
          'two.tsx': { TWO_SCENES: { harborline: Scene } },
        },
      }),
    ).toThrow('Duplicate scene "harborline" in one.tsx and two.tsx');
  });

  it('renders a visible unknown-id alert with nearby ids', () => {
    window.history.replaceState(null, '', '/?scene=comments-typo');
    render(<MockScene />);
    expect(screen.getByRole('alert').textContent).toContain('Unknown scene "comments-typo"');
    expect(screen.getByRole('link', { name: 'comments-action-bar' }).getAttribute('href')).toBe(
      '?scene=comments-action-bar',
    );
    expect(screen.queryByText('Workspaces')).toBeNull();
  });

  it.each(Object.entries(MOCK_SCENES))('renders %s without crashing', async (id, Scene) => {
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(document.body.textContent?.trim() ?? '').not.toBe('');
    if (id !== 'crash-report') {
      expect(document.body.textContent).not.toContain('Something went wrong');
    }
  });
});
