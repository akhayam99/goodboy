import { describe, expect, it } from 'vitest';
import type { MountId, ProjectId, SessionId, SessionProjectMount } from '@goodboy/types';
import { brandedId } from '../history/testing/brandedId';
import { pickerClusters } from './terminalPickerClusters';

const SESSION_ID = brandedId<SessionId>({ value: 'session-ledger' });
const OTHER = brandedId<SessionId>({ value: 'session-notify' });

type MountParams = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly project: string;
  readonly path: string;
  readonly branch: string;
  readonly isAttached?: boolean;
};

const mountOf = ({
  id,
  sessionId,
  project,
  path,
  branch,
  isAttached = true,
}: MountParams): SessionProjectMount => ({
  mountId: brandedId<MountId>({ value: id }),
  sessionId,
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
  { id: brandedId<ProjectId>({ value: 'payments-api' }), name: 'payments-api' },
  { id: brandedId<ProjectId>({ value: 'ledger-core' }), name: 'ledger-core' },
];

describe('pickerClusters', () => {
  it('puts the workspace folder first, then one cluster per session with attached worktrees', () => {
    const clusters = pickerClusters({
      folder: '/mock/harborline',
      sessions: [
        { id: SESSION_ID, title: 'Round settlement totals' },
        { id: OTHER, title: 'Back off failed retries' },
      ],
      mountsBySession: {
        [SESSION_ID]: [
          mountOf({
            id: 'm1',
            sessionId: SESSION_ID,
            project: 'payments-api',
            path: '/mock/harborline/payments-api/.goodboy/worktrees/gb-7k2q9x',
            branch: 'hl/a',
          }),
          mountOf({
            id: 'm2',
            sessionId: SESSION_ID,
            project: 'ledger-core',
            path: '/mock/wt/ledger-core',
            branch: 'hl/b',
            isAttached: false,
          }),
        ],
        [OTHER]: [
          mountOf({
            id: 'm3',
            sessionId: OTHER,
            project: 'ledger-core',
            path: '/mock/harborline/ledger-core/.goodboy/worktrees/gb-4m8d1c',
            branch: 'hl/c',
          }),
        ],
      },
      projects: PROJECTS,
    });

    expect(clusters.map((cluster) => cluster.title)).toEqual([
      'Workspace folder',
      'Round settlement totals',
      'Back off failed retries',
    ]);
    const first = clusters[1]?.rows[0];
    expect(clusters[1]?.rows).toHaveLength(1);
    expect(first).toMatchObject({
      projectName: 'payments-api',
      branch: 'hl/a',
      folder: 'gb-7k2q9x',
      path: '/mock/harborline/payments-api/.goodboy/worktrees/gb-7k2q9x',
    });
    expect(first?.target).toMatchObject({ kind: 'session', sessionId: SESSION_ID });
    expect(clusters[2]?.rows[0]?.folder).toBe('gb-4m8d1c');
  });

  it('keeps only the workspace folder when no session has a worktree', () => {
    const clusters = pickerClusters({
      folder: '/mock/harborline',
      sessions: [{ id: SESSION_ID, title: 'Round settlement totals' }],
      mountsBySession: {},
      projects: PROJECTS,
    });

    expect(clusters.map((cluster) => cluster.title)).toEqual(['Workspace folder']);
  });

  it('leaves the workspace cluster out when the folder is unknown', () => {
    expect(
      pickerClusters({ folder: null, sessions: [], mountsBySession: {}, projects: PROJECTS }),
    ).toEqual([]);
  });
});
