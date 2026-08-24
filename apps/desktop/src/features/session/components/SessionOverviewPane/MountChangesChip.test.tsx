// @vitest-environment happy-dom

import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';

type Mount = {
  readonly projectId: string;
  readonly mountName: string;
  readonly worktreePath: string;
  readonly branch: string;
};

type Stat = { readonly additions: number; readonly deletions: number };

const { store, stats } = vi.hoisted(() => ({
  store: {
    sessionProjectMounts: {} as Record<string, ReadonlyArray<Mount>>,
    openMountDiff: vi.fn(),
  },
  stats: { current: new Map<string, Stat>() },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (s: typeof store) => T) => selector(store),
  useMountDiffStats: () => stats.current,
}));

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    Tooltip: ({ content, children }: { content: string; children: ReactElement }) => (
      <span data-tooltip={content}>{children as ReactNode}</span>
    ),
  };
});

import { MountChangesChip } from './MountChangesChip';

const SESSION_ID = 'sess-1' as SessionId;

const mount = (over: Partial<Mount> = {}): Mount => ({
  projectId: 'project-1',
  mountName: 'api',
  worktreePath: '/worktrees/api',
  branch: 'ak/feat-x',
  ...over,
});

const WEB_MOUNT = mount({
  projectId: 'project-2',
  mountName: 'web',
  worktreePath: '/worktrees/web',
});

beforeEach(() => {
  store.sessionProjectMounts = { [SESSION_ID]: [mount()] };
  store.openMountDiff.mockReset();
  stats.current = new Map([['/worktrees/api', { additions: 12, deletions: 3 }]]);
});

afterEach(cleanup);

describe('MountChangesChip', () => {
  it('states the additions and deletions of the only mount that changed', () => {
    render(<MountChangesChip sessionId={SESSION_ID} />);

    const chip = screen.getByRole('button', { name: 'View the changes of api' });
    expect(chip.textContent).toBe('+12-3');
    expect(chip.closest('[data-tooltip]')?.getAttribute('data-tooltip')).toBe(
      'Uncommitted work in api, click to see the changes',
    );
  });

  it('opens the diff of that mount without switching the active project', () => {
    render(<MountChangesChip sessionId={SESSION_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'View the changes of api' }));

    expect(store.openMountDiff).toHaveBeenCalledWith(SESSION_ID, '/worktrees/api');
  });

  it('counts the projects and sums their changes when several mounts moved', () => {
    store.sessionProjectMounts = { [SESSION_ID]: [mount(), WEB_MOUNT] };
    stats.current = new Map([
      ['/worktrees/api', { additions: 12, deletions: 3 }],
      ['/worktrees/web', { additions: 108, deletions: 15 }],
    ]);

    render(<MountChangesChip sessionId={SESSION_ID} />);

    const chip = screen.getByRole('button', { name: 'View the changes of 2 projects' });
    expect(chip.textContent).toBe('2 projects+120-18');
    expect(chip.closest('[data-tooltip]')?.getAttribute('data-tooltip')).toBe(
      '2 projects have uncommitted work, click to see the changes',
    );
  });

  it('lands on the busiest mount so the diff switcher opens where the work is', () => {
    store.sessionProjectMounts = { [SESSION_ID]: [mount(), WEB_MOUNT] };
    stats.current = new Map([
      ['/worktrees/api', { additions: 12, deletions: 3 }],
      ['/worktrees/web', { additions: 108, deletions: 15 }],
    ]);

    render(<MountChangesChip sessionId={SESSION_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'View the changes of 2 projects' }));

    expect(store.openMountDiff).toHaveBeenCalledWith(SESSION_ID, '/worktrees/web');
  });

  it('ignores the clean mounts when it counts the projects', () => {
    store.sessionProjectMounts = { [SESSION_ID]: [mount(), WEB_MOUNT] };
    stats.current = new Map([
      ['/worktrees/api', { additions: 12, deletions: 3 }],
      ['/worktrees/web', { additions: 0, deletions: 0 }],
    ]);

    render(<MountChangesChip sessionId={SESSION_ID} />);

    expect(screen.getByRole('button', { name: 'View the changes of api' })).toBeDefined();
  });

  it('stays out of the header while every mount is clean', () => {
    stats.current = new Map([['/worktrees/api', { additions: 0, deletions: 0 }]]);

    render(<MountChangesChip sessionId={SESSION_ID} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('stays out of the header when the session has no mount', () => {
    store.sessionProjectMounts = {};

    render(<MountChangesChip sessionId={SESSION_ID} />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
