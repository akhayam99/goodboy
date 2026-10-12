import { describe, expect, it } from 'vitest';
import type { MountId, ProjectId, SessionId, SessionProjectMount } from '@goodboy/types';
import { displayCwd, terminalMenuTargets, terminalTargets } from './terminalTargets';
import { brandedId } from '../../features/history/testing/brandedId';

const SESSION_ID = brandedId<SessionId>({ value: 'session-ledger' });

type MountParams = {
  readonly id: string;
  readonly project: string;
  readonly path: string;
  readonly branch: string;
  readonly isAttached?: boolean;
};

const mountOf = ({
  id,
  project,
  path,
  branch,
  isAttached = true,
}: MountParams): SessionProjectMount => ({
  mountId: brandedId<MountId>({ value: id }),
  sessionId: SESSION_ID,
  projectId: brandedId<ProjectId>({ value: project }),
  mountName: project,
  worktreePath: path,
  lastWorktreePath: path,
  repoRoot: `/mock/harborline/${project}`,
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached,
  diskState: 'present',
  revision: 1,
});

const PROJECTS = [
  {
    id: brandedId<ProjectId>({ value: 'payments-api' }),
    name: 'payments-api',
    rootPath: '/mock/harborline/payments-api',
  },
  {
    id: brandedId<ProjectId>({ value: 'ledger-core' }),
    name: 'ledger-core',
    rootPath: '/mock/harborline/ledger-core',
  },
];

describe('terminalTargets', () => {
  it('lists the workspace folder, one chip per mount and the main checkout', () => {
    const targets = terminalTargets({
      folder: '/mock/harborline',
      sessionId: SESSION_ID,
      mounts: [
        mountOf({
          id: 'm1',
          project: 'payments-api',
          path: '/mock/wt/payments-api',
          branch: 'hl/fix-duplicate-credit',
        }),
        mountOf({
          id: 'm2',
          project: 'ledger-core',
          path: '/mock/wt/ledger-core',
          branch: 'hl/ledger-rounding',
        }),
      ],
      projects: PROJECTS,
      selectedMountPath: '/mock/wt/ledger-core',
    });

    expect(targets.map((target) => target.label)).toEqual([
      'Workspace folder',
      'payments-api · hl/fix-duplicate-credit',
      'ledger-core · hl/ledger-rounding',
      'Main checkout',
    ]);
    expect(targets.at(-1)?.path).toBe('/mock/harborline/ledger-core');
  });

  it('offers only the workspace folder without a session', () => {
    const targets = terminalTargets({
      folder: '/mock/harborline',
      sessionId: null,
      mounts: [],
      projects: PROJECTS,
      selectedMountPath: null,
    });

    expect(targets.map((target) => target.label)).toEqual(['Workspace folder']);
  });

  it('skips a detached mount', () => {
    const targets = terminalTargets({
      folder: null,
      sessionId: SESSION_ID,
      mounts: [
        mountOf({
          id: 'm1',
          project: 'payments-api',
          path: '/mock/wt/payments-api',
          branch: 'hl/x',
          isAttached: false,
        }),
      ],
      projects: PROJECTS,
      selectedMountPath: null,
    });

    expect(targets).toEqual([]);
  });
});

describe('displayCwd', () => {
  it('trims the workspace folder off a project path', () => {
    expect(
      displayCwd({ cwd: '/mock/harborline/payments-api', folder: '/mock/harborline', home: null }),
    ).toBe('payments-api');
  });

  it('names the folder itself', () => {
    expect(displayCwd({ cwd: '/mock/harborline/', folder: '/mock/harborline', home: null })).toBe(
      'harborline',
    );
  });

  it('shortens a path under home', () => {
    expect(
      displayCwd({ cwd: '/Users/mock/wt/api', folder: '/mock/harborline', home: '/Users/mock' }),
    ).toBe('~/wt/api');
  });

  it('is empty without a cwd', () => {
    expect(displayCwd({ cwd: null, folder: null, home: null })).toBe('');
  });
});

describe('terminalMenuTargets', () => {
  const OTHER = brandedId<SessionId>({ value: 'session-notify' });

  it('lists the workspace folder, then every attached worktree grouped by session', () => {
    const targets = terminalMenuTargets({
      folder: '/mock/harborline',
      sessions: [
        { id: SESSION_ID, title: 'Round settlement totals' },
        { id: OTHER, title: 'Back off failed retries' },
      ],
      mountsBySession: {
        [SESSION_ID]: [
          mountOf({
            id: 'm1',
            project: 'payments-api',
            path: '/mock/wt/payments-api',
            branch: 'hl/a',
          }),
          mountOf({
            id: 'm2',
            project: 'ledger-core',
            path: '/mock/wt/ledger-core',
            branch: 'hl/b',
            isAttached: false,
          }),
        ],
        [OTHER]: [
          {
            ...mountOf({
              id: 'm3',
              project: 'ledger-core',
              path: '/mock/wt2/ledger-core',
              branch: 'hl/c',
            }),
            sessionId: OTHER,
          },
        ],
      },
      projects: PROJECTS,
    });

    expect(targets.map((target) => [target.label, target.group ?? null, target.path])).toEqual([
      ['Workspace folder', null, '/mock/harborline'],
      ['payments-api · hl/a', 'Round settlement totals', '/mock/wt/payments-api'],
      ['ledger-core · hl/c', 'Back off failed retries', '/mock/wt2/ledger-core'],
    ]);
    expect(targets[1]).toMatchObject({ kind: 'session', sessionId: SESSION_ID });
    expect(targets[2]).toMatchObject({ kind: 'session', sessionId: OTHER });
  });

  it('keeps only the workspace folder when no session has a worktree', () => {
    const targets = terminalMenuTargets({
      folder: '/mock/harborline',
      sessions: [{ id: SESSION_ID, title: 'Round settlement totals' }],
      mountsBySession: {},
      projects: PROJECTS,
    });

    expect(targets.map((target) => target.label)).toEqual(['Workspace folder']);
  });
});
