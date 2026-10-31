// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../shared/components/Toast';
import { ObjectMenuProvider } from '../../features/actions/components/ObjectMenuProvider';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../store/runtime/worktreeStatuses/cache';
import { clearSceneInvoke } from '../../test/sceneInvoke';
import { MOCK_SCENES } from '../../app/components/MockScene';

const SETTLE_MS = 2_000;

type RowCase = {
  readonly row: string;
  readonly scene: string;
  readonly selector: string;
  readonly opens?: string;
  readonly isFirstOnly?: boolean;
};

const ROW_CASES: ReadonlyArray<RowCase> = [
  { row: 'rail session', scene: 'rail-pinned', selector: '[data-rail-session]' },
  { row: 'project folder', scene: 'c04-session-worktrees', selector: '[data-project-row] > *' },
  { row: 'central branch', scene: 'u27-central-branch-menu', selector: '[data-list-grid-row]' },
  {
    row: 'changed file and folder',
    scene: 'branch-files',
    selector: 'li[role="treeitem"][data-tree-row] > button',
  },
  { row: 'review comment', scene: 'resolve', selector: 'button[data-thread-id]' },
  {
    row: 'fix comment',
    scene: 'fixcomments-list',
    selector: '[aria-label^="Include the comment by"]',
  },
  { row: 'check run', scene: 'branch-checks', selector: '[data-check-row] button' },
  { row: 'decision change', scene: 'context-drawer', selector: 'button[data-change]' },
  { row: 'question card', scene: 'r4-questions-drawer', selector: '[data-oq-anchor]' },
  {
    row: 'other workspace',
    scene: 'r4-workspace-switcher',
    selector: '[data-workspace-row]',
    isFirstOnly: true,
  },
  {
    row: 'Activity decision and history batch',
    scene: 'activity-log',
    selector: '[data-row-id] button[aria-description^="Show "]',
  },
  {
    row: 'branch or pull request',
    scene: 'c04-session-worktrees',
    selector:
      'ul[aria-label$=" worktrees"] > li [data-row-opened], ul[aria-label$=" worktrees"] > li .group\\/row',
  },
  {
    row: 'finished branch',
    scene: 'c04-session-worktrees',
    selector: '[data-finished-fold] ul .group\\/row',
    opens: '[data-finished-fold] > button',
  },
  {
    row: 'linked work',
    scene: 'c04-session-worktrees',
    selector: 'ul[aria-label="Linked work"] > li button',
  },
  { row: 'worktree page', scene: 'c04-worktree-files', selector: '[data-worktree-entries] button' },
  {
    row: 'Auto launch',
    scene: 'u26-spawned-auto-light',
    selector: '[role="treeitem"][data-agent-id]',
  },
  {
    row: 'run launch and its agents',
    scene: 'u26-spawned-run-light',
    selector: '[role="treeitem"]',
  },
  {
    row: 'run step in Activity',
    scene: 'workflow-run-finished-sets',
    selector: '[data-testid^="run-tree-row-"] button',
  },
];

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
  window.getSelection()?.removeAllRanges();
});

type MountParams = {
  readonly scene: string;
};

const mount = async ({ scene }: MountParams): Promise<void> => {
  const Scene = MOCK_SCENES[scene];
  if (Scene === undefined) {
    throw new Error(`no scene ${scene}`);
  }
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <Scene />
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

const labelOf = ({ row }: { readonly row: Element }): Element => {
  const texts = Array.from(row.querySelectorAll('span')).filter(
    (span) => span.children.length === 0 && (span.textContent ?? '').trim() !== '',
  );
  return texts[0] ?? row;
};

type RightClickParams = {
  readonly target: Element;
};

const rightClick = ({ target }: RightClickParams): MouseEvent => {
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: 24,
    clientY: 24,
  });
  act(() => {
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 2 }));
    const range = document.createRange();
    range.selectNodeContents(target);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    target.dispatchEvent(event);
  });
  return event;
};

const closeMenu = (): void => {
  act(() => {
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
  });
  window.getSelection()?.removeAllRanges();
};

describe('every object row answers right click with our menu', () => {
  it.each(ROW_CASES)('$row rows in $scene', async ({ scene, selector, opens, isFirstOnly }) => {
    await mount({ scene });
    const opener = opens === undefined ? null : document.querySelector<HTMLElement>(opens);
    if (opener !== null) {
      await act(async () => {
        opener.click();
        await vi.advanceTimersByTimeAsync(SETTLE_MS);
      });
    }
    const found = Array.from(document.querySelectorAll(selector));
    const rows = isFirstOnly === true ? found.slice(0, 1) : found;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const event = rightClick({ target: labelOf({ row }) });
      expect(event.defaultPrevented, row.textContent ?? '').toBe(true);
      expect(screen.queryByRole('menu'), row.textContent ?? '').not.toBeNull();
      closeMenu();
    }
  });

  it('lets prose the user selected before the right click keep the native menu', async () => {
    await mount({ scene: 'c07-auto-child' });
    const prose = document.querySelector('[data-reading-region] p');
    if (prose === null) {
      throw new Error('the transcript scene shows no prose');
    }
    const range = document.createRange();
    range.selectNodeContents(prose);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    act(() => {
      prose.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 2 }));
      prose.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
