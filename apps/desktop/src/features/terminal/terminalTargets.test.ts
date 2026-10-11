import { describe, expect, it } from 'vitest';
import type { MountId, ProjectId, SessionId, SessionProjectMount } from '@goodboy/types';
import { displayCwd, terminalTargets } from './terminalTargets';

const SESSION_ID = 'session-ledger' as SessionId;

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
  mountId: id as MountId,
  sessionId: SESSION_ID,
  projectId: project as ProjectId,
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
    id: 'payments-api' as ProjectId,
    name: 'payments-api',
    rootPath: '/mock/harborline/payments-api',
  },
  { id: 'ledger-core' as ProjectId, name: 'ledger-core', rootPath: '/mock/harborline/ledger-core' },
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
