// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  DiffComment,
  IsoDateTime,
  MountId,
  ProjectId,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { UnassignedNotes } from './UnassignedNotes';

const SESSION = 'session-ledger-export' as SessionId;
const PROJECT = 'project-payments-api' as ProjectId;

const note = (id: string, extra: Partial<DiffComment> = {}): DiffComment => ({
  id,
  sessionId: SESSION,
  filePath: 'src/ledger.ts',
  body: `Cast the ledger id in ${id}`,
  status: 'open',
  createdAt: '2026-10-01T10:00:00.000Z' as IsoDateTime,
  anchor: { side: 'new', lineNumber: 21 },
  authorKind: 'user',
  ...extra,
});

const mount: SessionProjectMount = {
  mountId: 'mount-a' as MountId,
  sessionId: SESSION,
  projectId: PROJECT,
  mountName: 'payments-api',
  worktreePath: '/wt/payments-api',
  lastWorktreePath: null,
  repoRoot: '/repo/payments-api',
  branch: 'feat/export',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('UnassignedNotes', () => {
  it('shows nothing when every note belongs to a branch', () => {
    useAppStore.setState({
      diffComments: { [SESSION]: [note('a', { projectId: PROJECT, branch: 'feat/export' })] },
      loadDiffComments: async () => undefined,
    });
    render(<UnassignedNotes sessionId={SESSION} />);
    expect(screen.queryByRole('region', { name: 'Unassigned notes' })).toBeNull();
  });

  it('titles the section with a level 2 heading and its count, never a bespoke h2', () => {
    useAppStore.setState({
      diffComments: { [SESSION]: [note('a'), note('c')] },
      loadDiffComments: async () => undefined,
    });
    render(<UnassignedNotes sessionId={SESSION} />);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe('Unassigned notes');
    const region = screen.getByRole('region', { name: 'Unassigned notes' });
    expect(within(region).getByText('2')).toBeDefined();
  });

  it('reads each unassigned note in full and moves one to the active branch', () => {
    const assign = vi.fn(async () => undefined);
    useAppStore.setState({
      diffComments: {
        [SESSION]: [
          note('a'),
          note('b', { projectId: PROJECT, branch: 'feat/export' }),
          note('c', { body: 'Link the export from the page header' }),
        ],
      },
      sessionProjectMounts: { [SESSION]: [mount] },
      loadDiffComments: async () => undefined,
      assignDiffComment: assign,
    });
    render(<UnassignedNotes sessionId={SESSION} />);
    screen.getByText('Cast the ledger id in a');
    screen.getByText('Link the export from the page header');
    expect(screen.queryByText('Cast the ledger id in b')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Move to feat/export' })[0]!);
    expect(assign).toHaveBeenCalledWith(SESSION, 'a', 'mount-a');
  });

  describe('with more than one branch in the session', () => {
    const second: SessionProjectMount = {
      ...mount,
      mountId: 'mount-b' as MountId,
      projectId: 'project-notify-relay' as ProjectId,
      mountName: 'notify-relay',
      branch: 'feat/retry',
      parallelIndex: 1,
    };
    const arrange = () => {
      const assign = vi.fn(async () => undefined);
      useAppStore.setState({
        diffComments: { [SESSION]: [note('a'), note('c', { body: 'Link the export' })] },
        sessionProjectMounts: { [SESSION]: [mount, second] },
        loadDiffComments: async () => undefined,
        assignDiffComment: assign,
      });
      render(<UnassignedNotes sessionId={SESSION} />);
      return assign;
    };

    it('opens a branch chooser inline instead of guessing one', () => {
      const assign = arrange();
      expect(screen.queryByRole('group', { name: 'Move to a branch' })).toBeNull();

      const toggles = screen.getAllByRole('button', { name: 'Move to' });
      expect(toggles[0]?.getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(toggles[0]!);

      const chooser = screen.getByRole('group', { name: 'Move to a branch' });
      expect(
        within(chooser)
          .getAllByRole('button')
          .map((button) => button.textContent),
      ).toEqual(['feat/exportpayments-api', 'feat/retrynotify-relay']);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(assign).not.toHaveBeenCalled();
    });

    it('moves the note to the branch that was picked and closes the chooser', () => {
      const assign = arrange();
      fireEvent.click(screen.getAllByRole('button', { name: 'Move to' })[0]!);

      fireEvent.click(screen.getByRole('button', { name: /feat\/retry/ }));

      expect(assign).toHaveBeenCalledWith(SESSION, 'a', 'mount-b');
      expect(screen.queryByRole('group', { name: 'Move to a branch' })).toBeNull();
    });

    it('lists a branch once when two mounts share it', () => {
      useAppStore.setState({
        diffComments: { [SESSION]: [note('a')] },
        sessionProjectMounts: {
          [SESSION]: [mount, { ...mount, mountId: 'mount-c' as MountId, parallelIndex: 1 }, second],
        },
        loadDiffComments: async () => undefined,
      });
      render(<UnassignedNotes sessionId={SESSION} />);

      fireEvent.click(screen.getByRole('button', { name: 'Move to' }));

      expect(
        within(screen.getByRole('group', { name: 'Move to a branch' })).getAllByRole('button'),
      ).toHaveLength(2);
    });
  });

  describe('discard', () => {
    it('keeps Move to and Discard visible on the row, with no menu', () => {
      useAppStore.setState({
        diffComments: { [SESSION]: [note('a')] },
        sessionProjectMounts: { [SESSION]: [mount] },
        loadDiffComments: async () => undefined,
      });
      render(<UnassignedNotes sessionId={SESSION} />);

      expect(screen.getByRole('button', { name: /^Move to/ })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Discard' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Note actions' })).toBeNull();
    });

    const arrange = (notes: ReadonlyArray<DiffComment>) => {
      const discard = vi.fn(async () => undefined);
      useAppStore.setState({
        diffComments: { [SESSION]: notes },
        sessionProjectMounts: { [SESSION]: [mount] },
        loadDiffComments: async () => undefined,
        discardDiffComments: discard,
      });
      render(<UnassignedNotes sessionId={SESSION} />);
      return discard;
    };

    it('discards one note at once, with no confirmation', () => {
      const discard = arrange([note('a'), note('c')]);

      fireEvent.click(screen.getAllByRole('button', { name: 'Discard' })[1]!);

      expect(discard).toHaveBeenCalledWith({ sessionId: SESSION, ids: ['c'] });
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('offers Discard all from two notes and discards them together', () => {
      const discard = arrange([note('a'), note('c')]);

      fireEvent.click(screen.getByRole('button', { name: 'Discard all' }));

      expect(discard).toHaveBeenCalledWith({ sessionId: SESSION, ids: ['a', 'c'] });
    });

    it('has no Discard all for a single note', () => {
      arrange([note('a')]);

      expect(screen.getByRole('button', { name: 'Discard' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Discard all' })).toBeNull();
    });

    it('still discards when the session has no branch to move to', () => {
      const discard = vi.fn(async () => undefined);
      useAppStore.setState({
        diffComments: { [SESSION]: [note('a')] },
        sessionProjectMounts: { [SESSION]: [] },
        loadDiffComments: async () => undefined,
        discardDiffComments: discard,
      });
      render(<UnassignedNotes sessionId={SESSION} />);

      expect(screen.queryByRole('button', { name: /Move to/ })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

      expect(discard).toHaveBeenCalledWith({ sessionId: SESSION, ids: ['a'] });
    });
  });
});
