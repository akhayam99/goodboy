// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { aProject, aSession } from '@goodboy/types/testing';
import {
  brandId,
  type MountId,
  type ProjectId,
  type SessionId,
  type SessionProjectMount,
} from '@goodboy/types';
import { DEFAULT_BRANCH_PREFIX } from '../../../features/settings/settings';
import { forgetMaterializationSeed, rememberMaterializationSeed } from './materializationSeeds';
import { mountPlan, type MountPlanState } from './mountPlan';

const SID = brandId<SessionId>({ value: 'ab12cd34-ef56-7890' });
const PID = brandId<ProjectId>({ value: 'project-1' });
const MID = brandId<MountId>({ value: 'mount-1' });

const firstMount = ({ branch }: { readonly branch: string }): SessionProjectMount => ({
  mountId: brandId<MountId>({ value: 'mount-first' }),
  sessionId: SID,
  projectId: PID,
  mountName: 'goodboy',
  worktreePath: '/repos/goodboy/.goodboy/worktrees/gb-first',
  lastWorktreePath: null,
  repoRoot: '/repos/goodboy',
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
});

type PlanParams = {
  readonly goal: string;
  readonly repoBranches: ReadonlyArray<string>;
  readonly mountedBranch?: string;
};

const planFor = ({ goal, repoBranches, mountedBranch }: PlanParams) => {
  const session = aSession({ id: SID, goal });
  const project = aProject({
    id: PID,
    workspaceId: session.workspaceId,
    kind: 'repo',
    rootPath: '/repos/goodboy',
    baseBranch: 'main',
  });
  const state: MountPlanState = {
    sessions: [session],
    archivedSessions: {},
    projects: [project],
    workspaceOverrides: {},
    githubStatus: null,
    githubWorkspaceStatus: {},
    sessionWorktreeRecords: {},
    sessionProjectMounts:
      mountedBranch === undefined ? {} : { [SID]: [firstMount({ branch: mountedBranch })] },
    sessionExternalTasks: {},
  };
  return mountPlan({ state, sessionId: SID, projectId: PID, mountId: MID, repoBranches });
};

afterEach(() => {
  forgetMaterializationSeed({ sessionId: SID });
});

describe('mountPlan and a goal that names a branch', () => {
  it('adopts it from an Italian goal and cuts no new branch', () => {
    const plan = planFor({
      goal: 'lavora sul branch: ak/poc-start-funnel-subdomain',
      repoBranches: ['main', 'ak/poc-start-funnel-subdomain'],
    });

    expect(plan).toMatchObject({
      adoptedBranch: 'ak/poc-start-funnel-subdomain',
      branch: null,
      isAdoptedFromGoal: true,
    });
  });

  it('adopts it from an English goal, remote only branches included', () => {
    const plan = planFor({
      goal: 'Work on branch `ak/only-on-origin` and add tests',
      repoBranches: ['main', 'ak/only-on-origin'],
    });

    expect(plan?.adoptedBranch).toBe('ak/only-on-origin');
  });

  it('keeps the new branch and lists both when the goal names two', () => {
    const plan = planFor({
      goal: 'compare ak/one-branch with ak/two-branch',
      repoBranches: ['ak/one-branch', 'ak/two-branch'],
    });

    expect(plan?.adoptedBranch).toBeNull();
    expect(plan?.branch).not.toBeNull();
    expect(plan?.goalBranches).toEqual(['ak/one-branch', 'ak/two-branch']);
  });

  it('names the branch as before when the goal names none', () => {
    const plan = planFor({ goal: 'Ship the rebase row', repoBranches: ['ak/one-branch'] });

    expect(plan).toMatchObject({ adoptedBranch: null, goalBranches: [] });
    expect(plan?.branch).toBe(`${DEFAULT_BRANCH_PREFIX}/ship-the-rebase-row`);
  });

  it('lets an explicit seed branch win over the goal', () => {
    rememberMaterializationSeed({ sessionId: SID, seed: { existingBranch: 'ak/chosen' } });
    const plan = planFor({
      goal: 'work on ak/named-in-goal',
      repoBranches: ['ak/named-in-goal', 'ak/chosen'],
    });

    expect(plan).toMatchObject({ adoptedBranch: 'ak/chosen', isAdoptedFromGoal: false });
  });

  it('cuts a new branch when the owner chose to ignore the branch the goal names', () => {
    rememberMaterializationSeed({ sessionId: SID, seed: { isGoalBranchIgnored: true } });
    const plan = planFor({
      goal: 'work on ak/named-in-goal',
      repoBranches: ['ak/named-in-goal'],
    });

    expect(plan).toMatchObject({ adoptedBranch: null, goalBranches: [] });
    expect(plan?.branch).not.toBeNull();
  });

  it('adopts nothing for the second repository mount of a session', () => {
    const plan = planFor({
      goal: 'work on ak/named-in-goal',
      repoBranches: ['ak/named-in-goal'],
      mountedBranch: 'ak/first',
    });

    expect(plan?.adoptedBranch).toBeNull();
  });
});
