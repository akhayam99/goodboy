// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  Project,
  ProjectId,
  Session,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { DEFAULT_BRANCH_PREFIX } from '../../../features/settings/settings';
import { emptyOverrides } from '../../storyHarness';
import { forgetMaterializationSeed, rememberMaterializationSeed } from './materializationSeeds';
import { mountPlan, type MountPlanState } from './mountPlan';

const NOW = '2026-07-27T00:00:00.000Z' as IsoDateTime;
const SID = 'ab12cd34-ef56-7890' as SessionId;
const PID = 'project-1' as ProjectId;
const WID = 'workspace-1' as WorkspaceId;
const MID = 'mount-1' as MountId;

const session = {
  id: SID,
  workspaceId: WID,
  goal: 'Ship the rebase row',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
} satisfies Session;

const repoProject = {
  id: PID,
  workspaceId: WID,
  name: 'goodboy',
  kind: 'repo',
  rootPath: '/repos/goodboy',
  baseBranch: 'main',
  overrides: emptyOverrides,
  createdAt: NOW,
  updatedAt: NOW,
} satisfies Project;

const stateWith = (overrides: Partial<MountPlanState> = {}): MountPlanState =>
  ({
    sessions: [session],
    archivedSessions: {},
    projects: [repoProject],
    workspaceOverrides: {},
    sessionWorktreeRecords: {},
    sessionProjectMounts: {},
    sessionExternalTasks: {},
    ...overrides,
  }) as MountPlanState;

describe('mountPlan', () => {
  afterEach(() => {
    forgetMaterializationSeed({ sessionId: SID });
  });

  it('derives the branch, the base and the target path before anything is created', () => {
    const plan = mountPlan({ state: stateWith(), sessionId: SID, projectId: PID, mountId: MID });

    expect(plan?.baseBranch).toBe('main');
    expect(plan?.branch).toBe(`${DEFAULT_BRANCH_PREFIX}/ship-the-rebase-row`);
    expect(plan?.slug).toBe('ship-the-rebase-row');
    expect(plan?.targetPath).toBe('/repos/goodboy/.goodboy/worktrees/ship-the-rebase-row-mount-1');
  });

  it('leaves branch and base empty for a folder project and targets the sessions dir', () => {
    const folder = { ...repoProject, kind: 'folder', rootPath: '/notes' } satisfies Project;
    const plan = mountPlan({
      state: stateWith({ projects: [folder] }),
      sessionId: SID,
      projectId: PID,
      mountId: MID,
    });

    expect(plan?.branch).toBeNull();
    expect(plan?.baseBranch).toBeNull();
    expect(plan?.targetPath).toBe('/notes/sessions/ship-the-rebase-row');
  });

  it('reports the branches already taken by other live sessions', () => {
    const other = { ...session, id: 'session-other' as SessionId };
    const plan = mountPlan({
      state: stateWith({
        sessions: [session, other],
        sessionProjectMounts: {
          'session-other': [{ branch: 'ak/taken-branch' }],
        } as unknown as MountPlanState['sessionProjectMounts'],
      }),
      sessionId: SID,
      projectId: PID,
      mountId: MID,
    });

    expect(plan?.takenBranches).toContain('ak/taken-branch');
  });

  it('keeps an adopted branch slug out of the worktree path', () => {
    rememberMaterializationSeed({
      sessionId: SID,
      seed: { sessionSlug: 'alice/fix-parser', existingBranch: 'alice/fix-parser' },
    });

    const plan = mountPlan({ state: stateWith(), sessionId: SID, projectId: PID, mountId: MID });

    expect(plan?.slug).toBe('alice-fix-parser');
    expect(plan?.targetPath).toBe('/repos/goodboy/.goodboy/worktrees/alice-fix-parser-mount-1');
  });

  it('truncates a folder path at the backend budget, not at forty characters', () => {
    const folder = { ...repoProject, kind: 'folder', rootPath: '/notes' } satisfies Project;
    rememberMaterializationSeed({ sessionId: SID, seed: { sessionSlug: 'a'.repeat(45) } });

    const plan = mountPlan({
      state: stateWith({ projects: [folder] }),
      sessionId: SID,
      projectId: PID,
      mountId: MID,
    });

    expect(plan?.targetPath).toBe(`/notes/sessions/${'a'.repeat(45)}`);
  });

  it('falls back to a session slug the backend would not rewrite', () => {
    rememberMaterializationSeed({ sessionId: SID, seed: { sessionSlug: '***' } });

    const plan = mountPlan({ state: stateWith(), sessionId: SID, projectId: PID, mountId: MID });

    expect(plan?.slug).toBe('session-ab12cd34');
    expect(plan?.branch).toBe(`${DEFAULT_BRANCH_PREFIX}/session-ab12cd34`);
    expect(plan?.targetPath).toBe('/repos/goodboy/.goodboy/worktrees/session-ab12cd34-mount-1');
  });

  it('takes the next ordinal when another live session already owns the branch', () => {
    const other = { ...session, id: 'session-other' as SessionId };
    rememberMaterializationSeed({
      sessionId: SID,
      seed: { sessionSlug: '812-fix-the-login-flow' },
    });
    const state = stateWith({
      sessions: [session, other],
      sessionProjectMounts: {
        'session-other': [{ branch: `${DEFAULT_BRANCH_PREFIX}/812-fix-the-login-flow` }],
      } as unknown as MountPlanState['sessionProjectMounts'],
    });

    const plan = mountPlan({ state, sessionId: SID, projectId: PID, mountId: MID });

    expect(plan?.slug).toBe('812-fix-the-login-flow-2');
    expect(plan?.branch).toBe(`${DEFAULT_BRANCH_PREFIX}/812-fix-the-login-flow-2`);
    expect(plan?.targetPath).toBe(
      '/repos/goodboy/.goodboy/worktrees/812-fix-the-login-flow-2-mount-1',
    );
  });

  it('keeps the slug when the taken branch belongs to the session itself', () => {
    rememberMaterializationSeed({
      sessionId: SID,
      seed: { sessionSlug: '812-fix-the-login-flow' },
    });
    const state = stateWith({
      sessionProjectMounts: {
        [SID]: [{ branch: `${DEFAULT_BRANCH_PREFIX}/812-fix-the-login-flow` }],
      } as unknown as MountPlanState['sessionProjectMounts'],
    });

    const plan = mountPlan({ state, sessionId: SID, projectId: PID, mountId: MID });

    expect(plan?.slug).toBe('812-fix-the-login-flow');
  });

  it('never renames an adopted branch', () => {
    const other = { ...session, id: 'session-other' as SessionId };
    rememberMaterializationSeed({
      sessionId: SID,
      seed: { sessionSlug: 'fix-parser', existingBranch: `${DEFAULT_BRANCH_PREFIX}/fix-parser` },
    });
    const state = stateWith({
      sessions: [session, other],
      sessionProjectMounts: {
        'session-other': [{ branch: `${DEFAULT_BRANCH_PREFIX}/fix-parser` }],
      } as unknown as MountPlanState['sessionProjectMounts'],
    });

    const plan = mountPlan({ state, sessionId: SID, projectId: PID, mountId: MID });

    expect(plan?.slug).toBe('fix-parser');
    expect(plan?.adoptedBranch).toBe(`${DEFAULT_BRANCH_PREFIX}/fix-parser`);
  });

  it('cuts a long explicit slug at the final budget before checking for a collision', () => {
    const long = `812-${'harborline-checkout-totals-drift-after-refund'}`;
    rememberMaterializationSeed({ sessionId: SID, seed: { sessionSlug: long } });

    const plan = mountPlan({ state: stateWith(), sessionId: SID, projectId: PID, mountId: MID });

    expect(plan?.slug).toBe('812-harborline-checkout-totals-drift-after-refun');
    expect(plan?.slug.length).toBeLessThanOrEqual(48);
  });

  it('names the branch from the workspace template, with the task id and the user', () => {
    const state = stateWith({
      workspaceOverrides: {
        [WID]: {
          ...emptyOverrides,
          defaultBranchPrefix: 'team/hl',
          defaultBranchTemplate: '{prefix}/{user}/{task-id}-{slug}',
        },
      },
      githubStatus: { user: 'Mara-Quint' } as MountPlanState['githubStatus'],
    });

    const plan = mountPlan({
      state,
      sessionId: SID,
      projectId: PID,
      mountId: MID,
      taskIdentifiers: ['HAR-212'],
    });

    expect(plan?.branch).toBe('team/hl/mara-quint/har-212-ship-the-rebase-row');
    expect(plan?.targetPath).toBe(
      '/repos/goodboy/.goodboy/worktrees/har-212-ship-the-rebase-row-mount-1',
    );
  });

  it('drops the task id and the user when the session has neither', () => {
    const state = stateWith({
      workspaceOverrides: {
        [WID]: { ...emptyOverrides, defaultBranchTemplate: '{prefix}/{user}/{task-id}-{slug}' },
      },
    });

    const plan = mountPlan({ state, sessionId: SID, projectId: PID, mountId: MID });

    expect(plan?.branch).toBe(`${DEFAULT_BRANCH_PREFIX}/ship-the-rebase-row`);
  });

  it('adds -2 when the repository already has the branch, outside any session', () => {
    const plan = mountPlan({
      state: stateWith(),
      sessionId: SID,
      projectId: PID,
      mountId: MID,
      repoBranches: [`${DEFAULT_BRANCH_PREFIX}/ship-the-rebase-row`],
    });

    expect(plan?.branch).toBe(`${DEFAULT_BRANCH_PREFIX}/ship-the-rebase-row-2`);
  });

  it('returns null when the project does not belong to the session workspace', () => {
    const foreign = { ...repoProject, workspaceId: 'workspace-2' as WorkspaceId } satisfies Project;
    expect(
      mountPlan({
        state: stateWith({ projects: [foreign] }),
        sessionId: SID,
        projectId: PID,
        mountId: MID,
      }),
    ).toBeNull();
  });
});
