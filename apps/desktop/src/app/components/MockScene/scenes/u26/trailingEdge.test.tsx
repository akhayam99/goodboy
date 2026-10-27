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
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U26_REBASE_SCENES } from './rebase';

const SETTLE_MS = 2_000;

const SPACING_PX = 4;

const GLYPH_GAP_PX = SPACING_PX;

const RIGHT_PADDING: RegExp = /^(p|px|pr)-(\d+(?:\.5)?)$/;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

type ElementParams = {
  readonly element: Element;
};

const paddingOf = ({ element }: ElementParams): number => {
  const tokens = (element.getAttribute('class') ?? '').split(/\s+/);
  const valueOf = (kind: string): number | undefined => {
    const match = tokens
      .map((token) => RIGHT_PADDING.exec(token))
      .find((found) => found !== null && found[1] === kind);
    return match === undefined || match === null ? undefined : Number(match[2]) * SPACING_PX;
  };
  return valueOf('pr') ?? valueOf('px') ?? valueOf('p') ?? 0;
};

const insetFromCardOf = ({ element }: ElementParams): number => {
  const card = element.closest('[data-level-card]');
  if (card === null) {
    throw new Error('the element sits outside a level card');
  }
  let total = paddingOf({ element });
  let node = element.parentElement;
  while (node !== null && node !== card.parentElement) {
    total += paddingOf({ element: node });
    node = node.parentElement;
  }
  return total;
};

const allIn = (selector: string): ReadonlyArray<Element> => {
  const found = Array.from(
    screen.getByRole('group', { name: 'Projects' }).querySelectorAll(selector),
  );
  expect(found.length).toBeGreaterThan(0);
  return found;
};

describe('the right edge of the Projects card', () => {
  it('ends the plus buttons, the row dots, the chips and the header action on one edge', async () => {
    const Scene = U26_REBASE_SCENES['u26-rebase-all-running-dark'];
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    const boxes = [
      ...allIn('[data-card-actions] [data-level-add]'),
      ...allIn('[data-project-row] [aria-label^="New branch in"]'),
      ...allIn('[data-worktree-actions]'),
    ];
    const boxEdges = new Set(boxes.map((element) => insetFromCardOf({ element })));
    expect(boxEdges.size).toBe(1);

    const [boxEdge = 0] = Array.from(boxEdges);
    const pills = [...allIn('[data-chip-kind]'), screen.getByRole('button', { name: 'Abort' })];
    const pillEdges = new Set(pills.map((element) => insetFromCardOf({ element })));
    expect(Array.from(pillEdges)).toEqual([boxEdge + GLYPH_GAP_PX]);
  });
});
