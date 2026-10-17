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
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../../store/slices/worktreeStatuses/cache';
import { MOCK_SCENES } from '../..';
import { U25_R4_CONTENT_SCENES } from './r4-content';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U25_R4_CONTENT_SCENES;

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
  const Scene = U25_R4_CONTENT_SCENES[name];
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

const contextCards = (): ReadonlyArray<string> =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-context-card]')).map(
    (card) => card.getAttribute('aria-label') ?? '',
  );

describe('the r4 content scenes', () => {
  it('registers every scene for the capture', () => {
    Object.entries(U25_R4_CONTENT_SCENES).forEach(([name, Scene]) =>
      expect(MOCK_SCENES[name]).toBe(Scene),
    );
  });

  it('r4-context-cards draws Goal, Decisions, Summary and Explanations as cards', async () => {
    await mount('r4-context-cards');

    expect(contextCards()).toEqual(['Goal', 'Decisions', 'Summary', 'Explanations']);
    document.querySelectorAll<HTMLElement>('[data-context-card]').forEach((card) => {
      expect(card.querySelector('[data-band] h2')).not.toBeNull();
    });
  });

  it('r4-context-summary keeps Learned for the summary block only', async () => {
    await mount('r4-context-summary');

    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(within(summary).getByText('State')).toBeDefined();
    expect(screen.getAllByText('Learned')).toHaveLength(1);
    expect(within(summary).getByText('Learned')).toBeDefined();
  });

  it('r4-overview-title titles the page with the session name after its linked key', async () => {
    await mount('r4-overview-title');

    const title = screen.getByTestId('overview-title');
    expect(title.closest('h1')).not.toBeNull();
    expect(within(title).getByText('HBL-391').className).toContain('font-mono');
    expect(screen.queryByRole('heading', { level: 1, name: 'Overview' })).toBeNull();
  });

  it('r4-questions lists the questions on one grid, waiting first', async () => {
    await mount('r4-questions');

    expect(document.querySelectorAll('[data-list-grid]')).toHaveLength(1);
    const grid = document.querySelector<HTMLElement>('[data-list-grid]');
    const groups = Array.from(grid?.querySelectorAll('h2') ?? []).map((node) => node.textContent);
    expect(groups[0]).toBe('Waiting on you');
    expect(screen.queryByText('No questions')).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('r4-questions-drawer opens the first question in the drawer', async () => {
    await mount('r4-questions-drawer');

    expect(screen.getByRole('article')).toBeDefined();
    expect(document.querySelector('[data-list-grid-row][aria-current="true"]')).not.toBeNull();
  });
});
