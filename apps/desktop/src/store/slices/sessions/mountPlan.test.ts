import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  Project,
  ProjectId,
  Session,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { emptyOverrides } from '../../storyHarness';
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
  it('derives the branch, the base and the target path before anything is created', () => {
    const plan = mountPlan({ state: stateWith(), sessionId: SID, projectId: PID, mountId: MID });

    expect(plan?.baseBranch).toBe('main');
    expect(plan?.branch).toBe(`${plan?.prefix}/${plan?.slug}`);
    expect(plan?.slug).toBe('ship-the-rebase-row-ab12cd34');
    expect(plan?.targetPath).toBe(
      '/repos/goodboy/.goodboy/worktrees/ship-the-rebase-row-ab12cd34-mount-1',
    );
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
    expect(plan?.targetPath).toBe('/notes/sessions/ship-the-rebase-row-ab12cd34');
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
