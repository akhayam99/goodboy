// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { COLLAPSED_RAIL_WIDTH } from '@goodboy/ui';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { OPEN_REPORT_SHEET_EVENT } from '../../../features/bug-report/openReportSheet';
import { ColumnRail } from './ColumnRail';
import { SideColumn } from './index';
import type { ColumnActions } from './columnDoors';
import type { ColumnPlace } from './columnPlace';

const WORKSPACE = aWorkspace({ name: 'Harborline' });

let useAppStore: StoryStore;

const actions = (): ColumnActions => ({
  openBoard: vi.fn(),
  openInbox: vi.fn(),
  openChat: vi.fn(),
  openWorkflows: vi.fn(),
  openSettings: vi.fn(),
  openChangelog: vi.fn(),
  openGuide: vi.fn(),
  openShortcuts: vi.fn(),
});

type MountParams = {
  readonly place?: ColumnPlace;
  readonly scope?: 'workspace' | 'app';
  readonly doors?: ColumnActions;
  readonly settingsSlotRef?: (node: HTMLDivElement | null) => void;
  readonly isPeek?: boolean;
};

const mountColumn = ({
  place = 'board',
  scope = 'workspace',
  doors = actions(),
  settingsSlotRef,
  isPeek = false,
}: MountParams = {}) =>
  render(
    <SideColumn
      scope={scope}
      workspaceId={scope === 'workspace' ? WORKSPACE.id : null}
      currentSessionId={null}
      place={place}
      isCollapsed={false}
      actions={doors}
      onToggle={vi.fn()}
      isPeek={isPeek}
      {...(settingsSlotRef !== undefined && { settingsSlotRef })}
    />,
  );

const navLayer = (): HTMLElement =>
  document.querySelector('[data-column-layer="nav"]') as HTMLElement;

const doorNames = (root: HTMLElement): ReadonlyArray<string> =>
  Array.from(root.querySelectorAll('[data-column-door]')).map(
    (door) => door.getAttribute('data-column-door') ?? '',
  );

const currentDoors = (root: HTMLElement): ReadonlyArray<string> =>
  Array.from(root.querySelectorAll('[data-column-door][aria-current="page"]')).map(
    (door) => door.getAttribute('data-column-door') ?? '',
  );

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    archivedSessions: { [WORKSPACE.id]: [] },
  });
});

afterEach(cleanup);

describe('SideColumn', () => {
  it('stacks the toggle, New session, the four doors, the sessions, then Settings and the Goodboy row', () => {
    mountColumn();
    const nav = navLayer();

    expect(within(nav).getAllByRole('button')[0]?.getAttribute('aria-label')).toMatch(
      /^Hide sidebar/,
    );
    expect(doorNames(nav)).toEqual(['new', 'board', 'inbox', 'chat', 'workflows', 'settings']);
    expect(nav.querySelector('[data-column-sessions]')).not.toBeNull();
    const foot = nav.querySelector('[data-column-foot]') as HTMLElement;
    expect(within(foot).getByRole('button', { name: 'Settings' })).toBeDefined();
    expect(within(foot).getByTestId('goodboy-chip')).toBeDefined();
    expect(within(foot).getByRole('button', { name: 'Report a bug' })).toBeDefined();
  });

  it.each([
    ['board', ['board']],
    ['inbox', ['inbox']],
    ['chat', ['chat']],
    ['workflows', ['workflows']],
    ['settings', ['settings']],
    ['new', ['new']],
    ['impact', []],
    [null, []],
  ] as const)('marks only the %s door current', (place, expected) => {
    mountColumn({ place });

    expect(currentDoors(navLayer())).toEqual(expected);
  });

  it('opens each door through its action, and a current door does nothing', () => {
    const doors = actions();
    mountColumn({ place: 'inbox', doors });

    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Workflows' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }));

    expect(doors.openBoard).toHaveBeenCalledOnce();
    expect(doors.openChat).toHaveBeenCalledOnce();
    expect(doors.openWorkflows).toHaveBeenCalledOnce();
    expect(doors.openSettings).toHaveBeenCalledOnce();
    expect(doors.openInbox).not.toHaveBeenCalled();
  });

  it('asks for a new session from the emphasised row', () => {
    const onNew = vi.fn();
    window.addEventListener('goodboy:new-session', onNew);
    mountColumn();

    fireEvent.click(screen.getByRole('button', { name: 'New session' }));

    expect(onNew).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:new-session', onNew);
  });

  it('opens the report sheet from the bug button beside the Goodboy row', () => {
    const onReport = vi.fn();
    window.addEventListener(OPEN_REPORT_SHEET_EVENT, onReport);
    mountColumn();

    fireEvent.click(screen.getByRole('button', { name: 'Report a bug' }));

    expect(onReport).toHaveBeenCalledOnce();
    window.removeEventListener(OPEN_REPORT_SHEET_EVENT, onReport);
  });

  it('keeps only its app half before any workspace exists', () => {
    mountColumn({ scope: 'app', place: null });
    const nav = navLayer();

    expect(doorNames(nav)).toEqual(['settings']);
    expect(nav.querySelector('[data-column-sessions]')).toBeNull();
    expect(within(nav).getByTestId('goodboy-chip')).toBeDefined();
  });

  it('swaps its content for the settings layer while Settings is open', () => {
    const slots: Array<HTMLDivElement | null> = [];
    mountColumn({ place: 'settings', settingsSlotRef: (node) => slots.push(node) });

    const settings = document.querySelector('[data-column-layer="settings"]') as HTMLElement;
    expect(slots.at(-1)).toBe(settings);
    expect(settings.hasAttribute('inert')).toBe(false);
    expect(navLayer().hasAttribute('inert')).toBe(true);
  });

  it('keeps the doors live under any other place, with the settings layer inert', () => {
    mountColumn({ place: 'inbox', settingsSlotRef: () => undefined });

    expect(document.querySelector('[data-column-layer="settings"]')?.hasAttribute('inert')).toBe(
      true,
    );
    expect(navLayer().hasAttribute('inert')).toBe(false);
  });

  it('leaves the Goodboy menu effects to the pinned column when it peeks', () => {
    mountColumn({ isPeek: true });

    expect(screen.queryByTestId('goodboy-chip')).toBeNull();
    expect(document.querySelector('[data-goodboy-chip="column"]')).not.toBeNull();
    expect(document.querySelector('[data-column-layer="settings"]')).toBeNull();
  });
});

describe('ColumnRail', () => {
  const mountRail = ({
    place = 'board',
    scope = 'workspace',
  }: {
    readonly place?: ColumnPlace;
    readonly scope?: 'workspace' | 'app';
  } = {}) =>
    render(<ColumnRail scope={scope} place={place} onToggle={vi.fn()} actions={actions()} />);

  it('keeps every door at 44px: toggle, New, the four doors, then Settings, the bug and the mark', () => {
    const { container } = mountRail();
    const rail = container.querySelector('[data-column-rail]') as HTMLElement;

    expect(rail.style.width).toBe(`${COLLAPSED_RAIL_WIDTH}px`);
    expect(within(rail).getAllByRole('button')[0]?.getAttribute('aria-label')).toMatch(
      /^Show sidebar/,
    );
    expect(doorNames(rail)).toEqual(['new', 'board', 'inbox', 'chat', 'workflows', 'settings']);
    expect(within(rail).getByRole('button', { name: 'Report a bug' })).toBeDefined();
    expect(rail.querySelector('[data-goodboy-chip="rail"]')).not.toBeNull();
  });

  it.each([
    ['board', ['board']],
    ['chat', ['chat']],
    ['settings', ['settings']],
    ['new', ['new']],
    [null, []],
  ] as const)('marks only the %s door current on the rail too', (place, expected) => {
    const { container } = mountRail({ place });

    expect(currentDoors(container)).toEqual(expected);
  });

  it('keeps Settings, the bug and the mark with no workspace', () => {
    const { container } = mountRail({ scope: 'app', place: null });

    expect(doorNames(container)).toEqual(['settings']);
    expect(screen.getByRole('button', { name: 'Report a bug' })).toBeDefined();
  });
});
