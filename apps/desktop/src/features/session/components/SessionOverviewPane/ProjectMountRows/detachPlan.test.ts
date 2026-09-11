import { describe, expect, it } from 'vitest';
import type { BranchIntegration, WorktreeDetachAssessment } from '@goodboy/types';
import {
  buildDetachPlan,
  detachActionFor,
  detachOutcomeMessage,
  summarizeDetachOutcomes,
  type MountAssessment,
} from './detachPlan';

const plan = ({
  assessments,
  isRepoProject = true,
  blockers = [],
}: {
  readonly assessments: ReadonlyArray<MountAssessment> | null;
  readonly isRepoProject?: boolean;
  readonly blockers?: ReadonlyArray<'agent-running' | 'terminal-open'>;
}) =>
  buildDetachPlan({
    projectName: 'api',
    worktreePath: '/worktrees/api',
    isRepoProject,
    blockers,
    assessments,
  });

const MERGED = { kind: 'merged', base: 'origin/main' } satisfies BranchIntegration;

const mount = ({
  path = '/worktrees/api',
  branch = 'ak/feat',
  affectedFiles,
  localOnlyCommits,
  hasUpstream,
  ignoredFiles = 0,
  ignoredFileSamples = [],
  integration = MERGED,
}: {
  readonly path?: string;
  readonly branch?: string;
  readonly affectedFiles: number;
  readonly localOnlyCommits: number;
  readonly hasUpstream: boolean;
  readonly ignoredFiles?: number;
  readonly ignoredFileSamples?: ReadonlyArray<string>;
  readonly integration?: BranchIntegration;
}): MountAssessment => ({
  worktreePath: path,
  branch,
  assessment: {
    kind: 'assessed',
    path,
    branch,
    hasUpstream,
    affectedFiles,
    localOnlyCommits,
    ignoredFiles,
    ignoredFileSamples,
    integration,
  } satisfies WorktreeDetachAssessment,
});

describe('buildDetachPlan', () => {
  it('waits for the assessment before proposing any disposition', () => {
    expect(plan({ assessments: null })).toEqual({ kind: 'checking' });
    expect(detachActionFor({ plan: { kind: 'checking' } })).toBeNull();
  });

  it('keeps a folder project ahead of any assessment', () => {
    expect(plan({ assessments: null, isRepoProject: false })).toEqual({
      kind: 'keep',
      reason: 'folder',
      lines: ['Detach api from this session; its folder at /worktrees/api will stay on disk.'],
      details: { totals: [], worktrees: [] },
    });
  });

  it('names the blocker of a folder project instead of promising its files stay', () => {
    const result = plan({
      assessments: null,
      isRepoProject: false,
      blockers: ['agent-running'],
    });

    expect(result).toMatchObject({
      kind: 'keep',
      reason: 'blocked',
      lines: ['Work is still running in api; stop it before removing this worktree.'],
    });
    expect(detachActionFor({ plan: result })).toBeNull();
  });

  it('names each distinct blocker it found', () => {
    expect(plan({ assessments: null, blockers: ['agent-running', 'terminal-open'] })).toMatchObject(
      {
        kind: 'keep',
        reason: 'blocked',
        lines: [
          'Work is still running in api; stop it before removing this worktree.',
          'A terminal is open in api; close it before removing this worktree.',
        ],
      },
    );
  });

  it('offers no disposition at all while a blocker stands', () => {
    expect(
      detachActionFor({ plan: plan({ assessments: null, blockers: ['agent-running'] }) }),
    ).toBeNull();
    expect(
      detachActionFor({ plan: plan({ assessments: null, blockers: ['terminal-open'] }) }),
    ).toBeNull();
  });

  it('states the loss once, without repeating the path', () => {
    expect(
      plan({ assessments: [mount({ affectedFiles: 1, localOnlyCommits: 1, hasUpstream: true })] }),
    ).toMatchObject({
      kind: 'risky',
      lines: [
        'Remove the worktree at /worktrees/api for ak/feat, which has 1 unpushed commit.',
        '1 uncommitted file will be deleted.',
        'ak/feat is merged into origin/main.',
        'The branch and its commits stay in the repository.',
      ],
      details: {
        totals: ['Files affected (1)', 'Unpushed commits (1)'],
        worktrees: [
          'ak/feat at /worktrees/api: 1 uncommitted file, 1 unpushed commit, merged into origin/main',
        ],
      },
    });
  });

  it('shows the zero deletion explicitly when only history is at risk', () => {
    expect(
      plan({ assessments: [mount({ affectedFiles: 0, localOnlyCommits: 0, hasUpstream: false })] }),
    ).toMatchObject({
      lines: [
        'Remove the worktree at /worktrees/api for ak/feat, which has no upstream.',
        'No uncommitted files will be deleted.',
        'ak/feat is merged into origin/main.',
        'The branch and its commits stay in the repository.',
      ],
      details: {
        totals: ['Files affected (0)', 'Local-only commits (0)'],
        worktrees: [
          'ak/feat at /worktrees/api: 0 uncommitted files, 0 local-only commits, merged into origin/main',
        ],
      },
    });
  });

  it('names ignored files at risk before promising branch retention', () => {
    expect(
      plan({
        assessments: [
          mount({
            affectedFiles: 0,
            localOnlyCommits: 0,
            hasUpstream: true,
            ignoredFiles: 2,
            ignoredFileSamples: ['.env.local', 'scratch/data.db'],
          }),
        ],
      }),
    ).toMatchObject({
      kind: 'risky',
      lines: [
        'Remove the worktree at /worktrees/api for ak/feat.',
        'No uncommitted files will be deleted.',
        '2 ignored files at risk, not tracked by git: .env.local, scratch/data.db.',
        'ak/feat is merged into origin/main.',
        'The branch and its commits stay in the repository.',
      ],
    });
  });

  it('aggregates every mount the detach will touch and breaks them down', () => {
    expect(
      plan({
        assessments: [
          mount({
            path: '/worktrees/api-one',
            branch: 'ak/one',
            affectedFiles: 2,
            localOnlyCommits: 0,
            hasUpstream: true,
          }),
          mount({
            path: '/worktrees/api-two',
            branch: 'ak/two',
            affectedFiles: 1,
            localOnlyCommits: 3,
            hasUpstream: false,
          }),
        ],
      }),
    ).toMatchObject({
      kind: 'risky',
      lines: [
        'Remove 2 worktrees for api, which have 3 local-only commits and 1 branch without an upstream.',
        '3 uncommitted files will be deleted.',
        'Every branch is merged into its base branch.',
        'The branches and their commits stay in the repository.',
      ],
      details: {
        totals: ['Files affected (3)', 'Local-only commits (3)'],
        worktrees: [
          'ak/one at /worktrees/api-one: 2 uncommitted files, 0 unpushed commits, merged into origin/main',
          'ak/two at /worktrees/api-two: 1 uncommitted file, 3 local-only commits, merged into origin/main',
        ],
      },
    });
  });

  it('makes the whole confirmation risky when one of several mounts is risky', () => {
    expect(
      plan({
        assessments: [
          mount({
            path: '/a',
            branch: 'ak/a',
            affectedFiles: 0,
            localOnlyCommits: 0,
            hasUpstream: true,
          }),
          mount({
            path: '/b',
            branch: 'ak/b',
            affectedFiles: 0,
            localOnlyCommits: 2,
            hasUpstream: true,
          }),
        ],
      }),
    ).toMatchObject({
      kind: 'risky',
      lines: [
        'Remove 2 worktrees for api, which have 2 unpushed commits.',
        'No uncommitted files will be deleted.',
        'Every branch is merged into its base branch.',
        'The branches and their commits stay in the repository.',
      ],
    });
  });

  it('pluralizes several unpublished branches correctly', () => {
    expect(
      plan({
        assessments: [
          mount({
            path: '/a',
            branch: 'ak/a',
            affectedFiles: 0,
            localOnlyCommits: 0,
            hasUpstream: false,
          }),
          mount({
            path: '/b',
            branch: 'ak/b',
            affectedFiles: 0,
            localOnlyCommits: 0,
            hasUpstream: false,
          }),
        ],
      }),
    ).toMatchObject({
      kind: 'risky',
      lines: [
        'Remove 2 worktrees for api, of which 2 branches have no upstream.',
        'No uncommitted files will be deleted.',
        'Every branch is merged into its base branch.',
        'The branches and their commits stay in the repository.',
      ],
    });
  });

  it('removes several clean worktrees under one concise confirmation', () => {
    expect(
      plan({
        assessments: [
          mount({
            path: '/a',
            branch: 'ak/a',
            affectedFiles: 0,
            localOnlyCommits: 0,
            hasUpstream: true,
          }),
          mount({
            path: '/b',
            branch: 'ak/b',
            affectedFiles: 0,
            localOnlyCommits: 0,
            hasUpstream: true,
          }),
        ],
      }),
    ).toEqual({
      kind: 'safe',
      lines: [
        'Remove 2 clean worktrees for api: 0 uncommitted files, 0 unpushed commits, and every branch is merged into its base branch.',
        'The branches stay in the repository.',
      ],
      details: { totals: [], worktrees: [] },
    });
  });

  it('refuses to promise safety for a set it could not fully read', () => {
    expect(
      plan({
        assessments: [
          mount({
            path: '/a',
            branch: 'ak/a',
            affectedFiles: 0,
            localOnlyCommits: 0,
            hasUpstream: true,
          }),
          {
            worktreePath: '/b',
            branch: 'ak/b',
            assessment: { kind: 'unavailable', path: '/b', branch: null },
          },
        ],
      }),
    ).toEqual({
      kind: 'keep',
      reason: 'unavailable',
      lines: [
        'The safety of 1 of 2 worktrees in api could not be verified; detach will keep every directory.',
      ],
      details: { totals: [], worktrees: ['ak/b at /b: not verified'] },
    });
  });

  it('keeps the single unverified worktree wording and offers a recheck', () => {
    const result = plan({
      assessments: [
        {
          worktreePath: '/worktrees/api',
          branch: 'ak/feat',
          assessment: { kind: 'unavailable', path: '/worktrees/api', branch: null },
        },
      ],
    });

    expect(result).toEqual({
      kind: 'keep',
      reason: 'unavailable',
      lines: [
        'The safety of ak/feat at /worktrees/api could not be verified; detach will keep the directory.',
      ],
      details: { totals: [], worktrees: [] },
    });
    expect(detachActionFor({ plan: result })).toMatchObject({ disposition: 'keep-files' });
  });

  it('treats an absent directory beside a dirty one as no extra loss', () => {
    expect(
      plan({
        assessments: [
          {
            worktreePath: '/gone',
            branch: 'ak/gone',
            assessment: { kind: 'missing', path: '/gone' },
          },
          mount({
            path: '/b',
            branch: 'ak/b',
            affectedFiles: 2,
            localOnlyCommits: 0,
            hasUpstream: true,
          }),
        ],
      }),
    ).toMatchObject({
      kind: 'risky',
      lines: [
        'Remove 2 worktrees for api.',
        '2 uncommitted files will be deleted.',
        'ak/b is merged into origin/main.',
        'The branches and their commits stay in the repository.',
      ],
      details: {
        totals: ['Files affected (2)', 'Unpushed commits (0)'],
        worktrees: [
          'ak/gone at /gone: directory already absent',
          'ak/b at /b: 2 uncommitted files, 0 unpushed commits, merged into origin/main',
        ],
      },
    });
  });

  it('keeps the files when the merge state of the only branch is unknown', () => {
    const result = plan({
      assessments: [
        mount({
          affectedFiles: 0,
          localOnlyCommits: 0,
          hasUpstream: true,
          integration: { kind: 'unknown' },
        }),
      ],
    });

    expect(result).toEqual({
      kind: 'keep',
      reason: 'unverified',
      lines: [
        'Whether ak/feat is merged into its base branch is unknown; detach will keep its files at /worktrees/api.',
        'Check again, or set the base branch for this project in Settings.',
      ],
      details: { totals: [], worktrees: [] },
    });
    expect(detachActionFor({ plan: result })).toMatchObject({ disposition: 'keep-files' });
  });

  it('keeps the files on an unknown merge state even when the tree is dirty', () => {
    const result = plan({
      assessments: [
        mount({
          affectedFiles: 4,
          localOnlyCommits: 2,
          hasUpstream: false,
          integration: { kind: 'unknown' },
        }),
      ],
    });

    expect(result).toMatchObject({ kind: 'keep', reason: 'unverified' });
    expect(detachActionFor({ plan: result })).toMatchObject({ disposition: 'keep-files' });
  });

  it('keeps every directory when one branch of several cannot be read against its base', () => {
    expect(
      plan({
        assessments: [
          mount({
            path: '/a',
            branch: 'ak/a',
            affectedFiles: 0,
            localOnlyCommits: 0,
            hasUpstream: true,
          }),
          mount({
            path: '/b',
            branch: 'ak/b',
            affectedFiles: 0,
            localOnlyCommits: 0,
            hasUpstream: true,
            integration: { kind: 'unknown' },
          }),
        ],
      }),
    ).toEqual({
      kind: 'keep',
      reason: 'unverified',
      lines: [
        'Whether 1 branch in api reached the base branch is unknown; detach will keep every directory.',
        'Check again, or set the base branch for this project in Settings.',
      ],
      details: { totals: [], worktrees: ['ak/b at /b: merge state unknown'] },
    });
  });

  it('says a clean branch is not merged instead of calling it done', () => {
    expect(
      plan({
        assessments: [
          mount({
            affectedFiles: 0,
            localOnlyCommits: 0,
            hasUpstream: true,
            integration: { kind: 'unmerged', base: 'origin/main', ahead: 3 },
          }),
        ],
      }),
    ).toEqual({
      kind: 'safe',
      lines: [
        'Remove the clean worktree at /worktrees/api: 0 uncommitted files, 0 unpushed commits, and ak/feat is not merged into origin/main yet.',
        'The branch and its commits stay in the repository.',
      ],
      details: {
        totals: ['Branches not merged into the base (1)'],
        worktrees: ['ak/feat at /worktrees/api: not merged into origin/main'],
      },
    });
  });

  it('names the base the project carries rather than assuming main', () => {
    expect(
      plan({
        assessments: [
          mount({
            affectedFiles: 0,
            localOnlyCommits: 0,
            hasUpstream: true,
            integration: { kind: 'merged', base: 'origin/develop' },
          }),
        ],
      }),
    ).toEqual({
      kind: 'safe',
      lines: [
        'Remove the clean worktree at /worktrees/api: 0 uncommitted files, 0 unpushed commits, and ak/feat is merged into origin/develop.',
        'The branch stays in the repository.',
      ],
      details: { totals: [], worktrees: [] },
    });
  });

  it('counts the unmerged branches in the details of a risky detach', () => {
    expect(
      plan({
        assessments: [
          mount({
            path: '/a',
            branch: 'ak/a',
            affectedFiles: 1,
            localOnlyCommits: 0,
            hasUpstream: true,
            integration: { kind: 'unmerged', base: 'origin/main', ahead: 2 },
          }),
          mount({
            path: '/b',
            branch: 'ak/b',
            affectedFiles: 0,
            localOnlyCommits: 0,
            hasUpstream: true,
          }),
        ],
      }),
    ).toMatchObject({
      kind: 'risky',
      lines: [
        'Remove 2 worktrees for api.',
        '1 uncommitted file will be deleted.',
        '1 branch is not merged into the base branch yet.',
        'The branches and their commits stay in the repository.',
      ],
      details: {
        totals: [
          'Files affected (1)',
          'Unpushed commits (0)',
          'Branches not merged into the base (1)',
        ],
      },
    });
  });
});

describe('detach outcomes', () => {
  it('reports the worst outcome of the mounts it touched', () => {
    expect(summarizeDetachOutcomes({ outcomes: [{ kind: 'removed' }, { kind: 'failed' }] })).toBe(
      'failed',
    );
    expect(summarizeDetachOutcomes({ outcomes: [{ kind: 'removed' }, { kind: 'kept' }] })).toBe(
      'kept',
    );
    expect(summarizeDetachOutcomes({ outcomes: [{ kind: 'removed' }] })).toBe('removed');
  });

  it('reports the returned disposition rather than the predicted one', () => {
    expect(
      detachOutcomeMessage({ kind: 'kept', projectName: 'api', worktreePath: '/worktrees/api' }),
    ).toBe('Detached api. Files remain at /worktrees/api.');
    expect(
      detachOutcomeMessage({ kind: 'failed', projectName: 'api', worktreePath: '/worktrees/api' }),
    ).toBe(
      'Could not finish removing the worktree. The mount is retained; check again before retrying.',
    );
  });
});
