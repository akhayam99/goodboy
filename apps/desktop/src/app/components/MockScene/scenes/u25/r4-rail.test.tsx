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

  it('r4-rail-session draws the cards with each worktree pages inline, the tools outside the rail', async () => {
    await mount('r4-rail-session');

    const projects = card('Folders');
    expect(entryLabels(projects)).toEqual(['Pull request', 'Comments', 'Files', 'Checks']);
    expect(
      within(projects)
        .getAllByRole('button', { name: /^Checks/ })[0]
        ?.getAttribute('aria-label'),
    ).toBe('Checks, 1 failing');
    expect(
      within(projects)
        .getAllByRole('button', { name: /^Comments/ })[0]
        ?.getAttribute('aria-label'),
    ).toBe('Comments, 2 need you');
    expect(card('Linked')).toBeDefined();
    expect(within(rail()).queryByRole('toolbar', { name: 'Session tools' })).toBeNull();
    expect(within(tools()).getAllByRole('button')).toHaveLength(5);
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
    const projects = card('Folders');
    const headerLabel = elementIn(projects, 'h2 button span');
    const projectIcon = elementIn(
      projects,
      '[data-card-project] [data-project-row] > button > svg',
    );

    const navLeft = insetOf({ element: navIcon, side: 'left', isOwnPaddingCounted: false });
    expect(insetOf({ element: headerLabel, side: 'left', isOwnPaddingCounted: false })).toBe(
      navLeft,
    );
    expect(insetOf({ element: projectIcon, side: 'left', isOwnPaddingCounted: false })).toBe(
      navLeft,
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
        element: elementIn(projects, '[data-entry-slot]'),
        side: 'right',
        isOwnPaddingCounted: false,
      }),
    ).toBe(navRight);
    expect(
      insetOf({
        element: elementIn(projects, '[data-worktree-dot]'),
        side: 'right',
        isOwnPaddingCounted: false,
      }),
    ).toBe(navRight);
  });

  it('r4-rail-cards-folded folds both cards and keeps the failing check as one header dot', async () => {
    await mount('r4-rail-cards-folded');

    expect(
      within(card('Folders'))
        .getByRole('button', { name: 'Folders' })
        .getAttribute('aria-expanded'),
    ).toBe('false');
    expect(card('Folders').querySelector('[data-card-signal]')).not.toBeNull();
    expect(
      within(card('Linked')).getByRole('button', { name: 'Linked' }).getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('r4-rail-worktree drills into the worktree level with Files selected', async () => {
    await mount('r4-rail-worktree');

    expect(rail().getAttribute('data-session-rail')).toBe('worktree');
    const worktree = within(screen.getByRole('navigation', { name: 'Worktree' }));
    expect(worktree.getByRole('button', { name: /^Files/ }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('r4-rail-tools-open presses Context while its drawer is open', async () => {
    await mount('r4-rail-tools-open');

    expect(useAppStore.getState().drawer?.kind).toBe('context');
    const pressed = within(tools())
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-pressed') === 'true')
      .map((button) => button.getAttribute('aria-label'));
    expect(pressed).toEqual(['Context']);
  });

  it('r4-rail-folded folds the rail with no foot and keeps the tools column', async () => {
    await mount('r4-rail-folded');

    expect(rail().hasAttribute('data-rail-folded')).toBe(true);
    expect(rail().querySelector('[data-session-foot]')).toBeNull();
    expect(within(tools()).getAllByRole('button')).toHaveLength(5);
  });

  it('r4-rail-tree draws many branches with their pull request icons, two open at once', async () => {
    await mount('r4-rail-tree');

    const projects = card('Folders');
    const states = [...projects.querySelectorAll('[data-pr-state]')].map((icon) =>
      icon.getAttribute('data-pr-state'),
    );
    expect(states).toEqual([
      'open',
      'draft',
      'queued',
      'merged',
      'closed',
      'open',
      'approved',
      'none',
    ]);
    const open = [...projects.querySelectorAll('[data-worktree-toggle]')].filter(
      (toggle) => toggle.getAttribute('aria-expanded') === 'true',
    );
    expect(open).toHaveLength(2);
    expect(
      within(projects)
        .getAllByRole('button', { name: /, \d+ branch/ })
        .map((row) => row.querySelector('[data-project-count]')?.textContent),
    ).toEqual(['5', '3']);
    expect(rail().textContent).not.toMatch(/finished/i);
  });

  it('r4-rail-delete opens the delete confirm from the foot', async () => {
    await mount('r4-rail-delete');

    const dialog = screen.getByRole('dialog', { name: /^Delete .+\?$/ });
    expect(within(dialog).getByRole('button', { name: 'Delete session' })).toBeDefined();
  });
});
