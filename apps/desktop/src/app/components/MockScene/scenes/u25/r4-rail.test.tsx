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
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_R4_RAIL_SCENES } from './r4-rail';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U25_R4_RAIL_SCENES;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U25_R4_RAIL_SCENES[name];
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

const rail = (): HTMLElement => screen.getByRole('navigation', { name: 'Session' });

const tools = (): HTMLElement => screen.getByRole('toolbar', { name: 'Session tools' });

const card = (name: string): HTMLElement => within(rail()).getByRole('group', { name });

const SPACING_PX = 4;

const CARD_EXTRA_SIDE_PX = SPACING_PX;

type Side = 'left' | 'right';

const SIDE_CLASS: Readonly<Record<Side, RegExp>> = {
  left: /^(?:p|px|pl)-(\d+(?:\.5)?)$/,
  right: /^(?:p|px|pr)-(\d+(?:\.5)?)$/,
};

type InsetParams = {
  readonly element: Element;
  readonly side: Side;
  readonly isOwnPaddingCounted: boolean;
};

const paddingOf = ({ element, side }: Omit<InsetParams, 'isOwnPaddingCounted'>): number =>
  (element.getAttribute('class') ?? '')
    .split(/\s+/)
    .map((token) => SIDE_CLASS[side].exec(token)?.[1])
    .filter((value): value is string => value !== undefined)
    .reduce((sum, value) => sum + Number(value) * SPACING_PX, 0);

const insetOf = ({ element, side, isOwnPaddingCounted }: InsetParams): number => {
  const level = element.closest('[data-session-level]');
  if (level === null) {
    throw new Error('the element sits outside the session level');
  }
  let total = isOwnPaddingCounted ? paddingOf({ element, side }) : 0;
  let node = element.parentElement;
  while (node !== null && node !== level) {
    total += paddingOf({ element: node, side });
    node = node.parentElement;
  }
  return total;
};

const elementIn = (scope: ParentNode, selector: string): Element => {
  const element = scope.querySelector(selector);
  if (element === null) {
    throw new Error(`no ${selector}`);
  }
  return element;
};

const entryLabels = (scope: HTMLElement): ReadonlyArray<string> =>
  [...scope.querySelectorAll('[data-worktree-entries] [data-entry-label]')].map(
    (label) => label.textContent ?? '',
  );

describe('r4 session rail scenes', () => {
  it('registers every scene with the mock scene registry', () => {
    for (const name of Object.keys(U25_R4_RAIL_SCENES)) {
      expect(MOCK_SCENES[name]).toBeDefined();
    }
  });

  it('r4-rail-session draws the cards with one line per branch and no pages until one is current, the tools outside the rail', async () => {
    await mount('r4-rail-session');

    const projects = card('Projects');
    expect(entryLabels(projects)).toEqual([]);
    expect(projects.querySelectorAll('[data-worktree-branch]').length).toBeGreaterThan(0);
    expect(card('Linked')).toBeDefined();
    expect(within(rail()).queryByRole('toolbar', { name: 'Session tools' })).toBeNull();
    expect(within(tools()).getAllByRole('button')).toHaveLength(6);
    const top = within(rail().querySelector<HTMLElement>('[data-rail-top]') ?? rail());
    expect(top.queryByRole('button', { name: 'More session actions' })).toBeNull();
    expect(top.getByRole('button', { name: 'Refresh session' })).toBeDefined();
    const foot = rail().querySelector<HTMLElement>('[data-session-foot]');
    expect(
      Array.from(foot?.querySelectorAll('[data-session-foot-action]') ?? []).map((button) =>
        button.getAttribute('aria-label'),
      ),
    ).toEqual(['Archive session', 'Delete session']);
    expect(foot?.querySelector('[data-session-spend]')).not.toBeNull();
  });

  it('r4-rail-session lines the cards up with the page rows, edges, icons and slots', async () => {
    await mount('r4-rail-session');

    const navRow = elementIn(rail(), '[data-testid="session-pages"] button');
    const navIcon = elementIn(navRow, 'svg');
    const navSlot = elementIn(rail(), '[data-page-value="runs"]');
    const projects = card('Projects');
    const headerLabel = elementIn(projects, 'h2 button span');
    const folderName = elementIn(
      projects,
      '[data-card-project] [data-project-row] > button > span',
    );

    const navLeft = insetOf({ element: navIcon, side: 'left', isOwnPaddingCounted: false });
    expect(insetOf({ element: headerLabel, side: 'left', isOwnPaddingCounted: false })).toBe(
      navLeft + CARD_EXTRA_SIDE_PX,
    );
    expect(insetOf({ element: folderName, side: 'left', isOwnPaddingCounted: false })).toBe(
      navLeft + CARD_EXTRA_SIDE_PX,
    );
    expect(insetOf({ element: projects, side: 'left', isOwnPaddingCounted: false })).toBe(
      insetOf({ element: navRow, side: 'left', isOwnPaddingCounted: false }),
    );
    expect(insetOf({ element: projects, side: 'right', isOwnPaddingCounted: false })).toBe(
      insetOf({ element: navRow, side: 'right', isOwnPaddingCounted: false }),
    );
    const navRight = insetOf({ element: navSlot, side: 'right', isOwnPaddingCounted: false });
    expect(
      insetOf({
        element: elementIn(projects, '[data-worktree-actions]'),
        side: 'right',
        isOwnPaddingCounted: false,
      }),
    ).toBe(navRight);
  });

  it('r4-rail-cards-folded folds both cards and keeps the failing check as one header dot', async () => {
    await mount('r4-rail-cards-folded');

    expect(
      within(card('Projects'))
        .getByRole('button', { name: 'Projects' })
        .getAttribute('aria-expanded'),
    ).toBe('false');
    expect(card('Projects').querySelector('[data-card-signal]')).not.toBeNull();
    expect(
      within(card('Linked')).getByRole('button', { name: 'Linked' }).getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('r4-rail-worktree opens the current branch in place with its pages and Files selected', async () => {
    await mount('r4-rail-worktree');

    expect(rail().getAttribute('data-session-rail')).toBe('session');
    const projects = card('Projects');
    expect(entryLabels(projects)).toEqual([
      'Pull request',
      'Comments',
      'Files',
      'Commits',
      'Checks',
    ]);
    expect(
      within(projects)
        .getByRole('button', { name: /^Files/ })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(
      within(projects)
        .getByRole('button', { name: /^Checks/ })
        .getAttribute('aria-label'),
    ).toBe('Checks, 1 failing');
    expect(
      within(projects)
        .getByRole('button', { name: /^Comments/ })
        .getAttribute('aria-label'),
    ).toBe('Comments, 2 need you');
  });

  it('r4-rail-tools-open presses Context while its drawer is open', async () => {
    await mount('r4-rail-tools-open');

    expect(useAppStore.getState().drawer?.kind).toBe('context');
    const pressed = within(tools())
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-pressed') === 'true')
      .map((button) => button.getAttribute('aria-label'));
    expect(pressed).toEqual(['Context']);
    expect(document.querySelector('[data-slot="page-trail"]')).toBeNull();
  });

  it('r4-rail-folded folds the rail with no foot and keeps the tools column', async () => {
    await mount('r4-rail-folded');

    expect(rail().hasAttribute('data-rail-folded')).toBe(true);
    expect(rail().querySelector('[data-session-foot]')).toBeNull();
    expect(within(tools()).getAllByRole('button')).toHaveLength(6);
  });

  it('r4-rail-tree draws many branches one line each in rank order, with the finished ones folded', async () => {
    await mount('r4-rail-tree');

    const projects = card('Projects');
    const live = [...projects.querySelectorAll('ul[aria-label$=" worktrees"] [data-pr-state]')].map(
      (icon) => icon.getAttribute('data-pr-state'),
    );
    expect(live).toEqual(['queued', 'open', 'draft', 'approved', 'open', 'none']);
    expect(
      within(projects)
        .getAllByRole('button', { name: /\d+ finished/ })
        .map((fold) => fold.textContent),
    ).toEqual(['2 finished']);
    expect(projects.querySelectorAll('[data-worktree-entries]')).toHaveLength(0);
  });

  it('r4-rail-tree cuts long titles at the end only and keeps the branch in the tooltip and the name', async () => {
    await mount('r4-rail-tree');

    const projects = card('Projects');
    for (const cell of projects.querySelectorAll('[data-worktree-branch]')) {
      expect(cell.querySelector('.shrink-0')).toBeNull();
      expect(cell.querySelector('[title]')).toBeNull();
    }
    const rows = within(projects).getAllByRole('button', {
      name: /branch ak\/eng-1200-retry-header-for-notify-relay-with-backoff-draft/,
    });
    expect(rows.length).toBeGreaterThan(0);
  });

  it('r4-rail-delete opens the delete confirm from the foot', async () => {
    await mount('r4-rail-delete');

    const dialog = screen.getByRole('dialog', { name: /^Delete .+\?$/ });
    expect(within(dialog).getByRole('button', { name: 'Delete session' })).toBeDefined();
  });
});
