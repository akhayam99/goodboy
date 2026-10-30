// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U30_NEW_SINCE_SCENES } from './new-since';

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
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

afterEach(cleanup);

const show = async () => {
  const Scene = U30_NEW_SINCE_SCENES['u30-new-since'];
  const view = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return view;
};

const rowsOf = ({ card }: { readonly card: HTMLElement }) =>
  Array.from(card.querySelectorAll<HTMLElement>('[data-done-latest]')).map((row) => ({
    row,
    title: row.querySelector('.text-foreground')?.textContent ?? '',
    meta: row.querySelector('[data-row-meta]')?.textContent ?? '',
  }));

describe('the u30 new since scene', () => {
  it('registers the scene for the capture', () => {
    expect(MOCK_SCENES['u30-new-since']).toBe(U30_NEW_SINCE_SCENES['u30-new-since']);
  });

  it('reads like a person: plain titles, role and provider, a count of agents, no step list', async () => {
    const { container } = await show();

    const card = container.querySelector<HTMLElement>('[data-overview-card="new-since"]');
    if (card === null) {
      throw new Error('no New since card');
    }
    const rows = rowsOf({ card });
    expect(rows.length).toBeGreaterThanOrEqual(5);
    const titles = rows.map((row) => row.title);
    expect(titles).toContain('Typecheck, lint, knip, oxfmt and vitest ok, no commit');
    expect(titles).toContain('Vitest green, typecheck fails only from the worktree env');
    expect(titles).toContain('Oxfmt, knip and hook tests green; tsc 2 errors in untouched files');
    const metas = rows.map((row) => row.meta);
    expect(metas).toContain('Tester');
    expect(metas).toContain('Implementer');
    expect(metas).toContain('Reviewer');
    expect(metas).toContain('Orchestrated · 3 agents · 3 steps');
    expect(metas.some((meta) => /^Auto · 2 agents/.test(meta))).toBe(true);
    for (const meta of metas) {
      expect(meta).not.toBe('Agent');
      expect(meta).not.toMatch(/\d+, \d+/);
      expect(meta).not.toMatch(/answered|decision/);
    }
    const agentRow = rows.find((row) => row.meta === 'Tester');
    expect(agentRow?.row.querySelector('[data-testid="agent-header-provider"]')).not.toBeNull();
    expect(within(card).queryByText('Agent')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = await show();

    const { violations } = await runA11yCheck(container);

    expect(violations).toEqual([]);
  });
});
