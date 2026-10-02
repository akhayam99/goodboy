// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { BootstrapPhase, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { aProject, aSession, TEST_NOW } from '@goodboy/types/testing';
import {
  firstLapProjectOfWorkspace,
  isProjectInFirstLap,
  selectFirstLapProject,
  selectLapProject,
} from './firstLap';

const WORKSPACE_ID = 'ws-cascadia' as WorkspaceId;
const PROJECT_ID = 'proj-cascadia' as ProjectId;
const LAP_SESSION = 'sess-lap' as SessionId;
const OTHER_SESSION = 'sess-other' as SessionId;
const BOOTSTRAP_SESSION = 'sess-bootstrap' as SessionId;

const phase = (patch: Partial<BootstrapPhase>): BootstrapPhase => ({
  stage: 'first-lap',
  firstLapSessionId: LAP_SESSION,
  bootstrapSessionId: null,
  snapshotId: null,
  worktreePath: null,
  branch: null,
  updatedAt: TEST_NOW,
  ...patch,
});

const stateOf = (bootstrapPhase: Readonly<Record<ProjectId, BootstrapPhase>>) => ({
  sessions: [
    aSession({ id: LAP_SESSION, workspaceId: WORKSPACE_ID }),
    aSession({ id: OTHER_SESSION, workspaceId: WORKSPACE_ID }),
    aSession({ id: BOOTSTRAP_SESSION, workspaceId: WORKSPACE_ID }),
  ],
  projects: [aProject({ id: PROJECT_ID, workspaceId: WORKSPACE_ID, kind: 'repo' })],
  bootstrapPhase,
});

describe('selectFirstLapProject', () => {
  it('finds the project only for the first lap session', () => {
    const state = stateOf({ [PROJECT_ID]: phase({}) });

    expect(selectFirstLapProject({ state, sessionId: LAP_SESSION })?.id).toBe(PROJECT_ID);
    expect(selectFirstLapProject({ state, sessionId: OTHER_SESSION })).toBeNull();
  });

  it('stops once the project leaves its first lap', () => {
    const moving = stateOf({ [PROJECT_ID]: phase({ stage: 'moving' }) });
    const done = stateOf({ [PROJECT_ID]: phase({ stage: 'done' }) });

    expect(selectFirstLapProject({ state: moving, sessionId: LAP_SESSION })).toBeNull();
    expect(selectFirstLapProject({ state: done, sessionId: LAP_SESSION })).toBeNull();
  });

  it('ignores a project that has no phase', () => {
    expect(selectFirstLapProject({ state: stateOf({}), sessionId: LAP_SESSION })).toBeNull();
  });
});

describe('selectLapProject', () => {
  it('reports a moving project as well as a first lap one', () => {
    const lap = stateOf({ [PROJECT_ID]: phase({}) });
    const moving = stateOf({ [PROJECT_ID]: phase({ stage: 'moving' }) });
    const done = stateOf({ [PROJECT_ID]: phase({ stage: 'done' }) });

    expect(selectLapProject({ state: lap, sessionId: LAP_SESSION })?.stage).toBe('first-lap');
    expect(selectLapProject({ state: moving, sessionId: LAP_SESSION })?.stage).toBe('moving');
    expect(selectLapProject({ state: done, sessionId: LAP_SESSION })).toBeNull();
    expect(selectLapProject({ state: lap, sessionId: OTHER_SESSION })).toBeNull();
  });

  it('reports an interrupted move to the bootstrap session it created', () => {
    const moving = stateOf({
      [PROJECT_ID]: phase({ stage: 'moving', bootstrapSessionId: BOOTSTRAP_SESSION }),
    });
    const lap = stateOf({ [PROJECT_ID]: phase({ bootstrapSessionId: BOOTSTRAP_SESSION }) });

    expect(selectLapProject({ state: moving, sessionId: BOOTSTRAP_SESSION })?.stage).toBe('moving');
    expect(selectLapProject({ state: lap, sessionId: BOOTSTRAP_SESSION })).toBeNull();
  });
});

describe('first lap helpers', () => {
  it('knows which projects are in their first lap', () => {
    const state = stateOf({ [PROJECT_ID]: phase({}) });

    expect(isProjectInFirstLap({ state, projectId: PROJECT_ID })).toBe(true);
    expect(isProjectInFirstLap({ state, projectId: 'proj-other' as ProjectId })).toBe(false);
    expect(firstLapProjectOfWorkspace({ state, workspaceId: WORKSPACE_ID })?.id).toBe(PROJECT_ID);
    expect(
      firstLapProjectOfWorkspace({ state, workspaceId: 'ws-other' as WorkspaceId }),
    ).toBeNull();
  });
});
