import { describe, expect, it, vi } from 'vitest';
import type { Project, ProjectId, Session, SessionId, WorkspaceId } from '@goodboy/types';
import { materializeDeclaredProjects } from './materializeDeclaredProjects';
import type { GetFn } from './types';

const NOW = '2026-08-22T00:00:00.000Z' as Session['createdAt'];
const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const project = (id: string, name: string): Project => ({
  id: id as ProjectId,
  workspaceId: WORKSPACE_ID,
  name,
  rootPath: `/tmp/${name}`,
  kind: 'repo',
  overrides: {
    defaultProviderId: null,
    defaultWorkflowId: null,
    defaultBranchPrefix: null,
    parallelEnabled: null,
    defaultVerbosity: null,
    providerBindings: null,
    taskModels: null,
    roleModels: null,
    parallelAgents: null,
    providerPool: null,
  },
  createdAt: NOW,
  updatedAt: NOW,
});

const session: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'ship',
  state: { kind: 'draft' },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  permissionMode: 'bypassPermissions',
  autoRun: false,
  titleUserEdited: false,
  workflowRuns: [],
  createdAt: NOW,
  updatedAt: NOW,
};

type HarnessOptions = {
  readonly projects: ReadonlyArray<Project>;
  readonly mounts?: ReadonlyArray<{ projectId: ProjectId }>;
};

const harness = ({ projects, mounts = [] }: HarnessOptions) => {
  const materializeProject = vi.fn(async () => ({}));
  const get = (() => ({
    sessions: [session],
    projects,
    sessionProjectMounts: { [SESSION_ID]: mounts },
    materializeProject,
  })) as unknown as GetFn;
  return { get, materializeProject };
};

describe('materializeDeclaredProjects', () => {
  it('materializes only the projects the step text names', async () => {
    const { get, materializeProject } = harness({
      projects: [project('p-api', 'api'), project('p-web', 'web'), project('p-docs', 'docs')],
    });

    await materializeDeclaredProjects({
      get,
      sessionId: SESSION_ID,
      stepName: 'Implement',
      declarationText: 'Change the api login route.\nThen wire the web form to it.',
    });

    expect(materializeProject).toHaveBeenCalledTimes(2);
    expect(materializeProject).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION_ID, projectId: 'p-api' }),
    );
    expect(materializeProject).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION_ID, projectId: 'p-web' }),
    );
  });

  it('carries the mentioning plan line into the reason', async () => {
    const { get, materializeProject } = harness({
      projects: [project('p-api', 'api'), project('p-web', 'web')],
    });

    await materializeDeclaredProjects({
      get,
      sessionId: SESSION_ID,
      stepName: 'Implement',
      declarationText: '- fix the api rate limiter',
    });

    expect(materializeProject).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'step "Implement": - fix the api rate limiter',
      }),
    );
  });

  it('does not match a project name embedded inside a longer word', async () => {
    const { get, materializeProject } = harness({
      projects: [project('p-api', 'api'), project('p-web', 'web')],
    });

    await materializeDeclaredProjects({
      get,
      sessionId: SESSION_ID,
      stepName: 'Implement',
      declarationText: 'improve the rapid webhook handler',
    });

    expect(materializeProject).not.toHaveBeenCalled();
  });

  it('skips projects that are already mounted', async () => {
    const { get, materializeProject } = harness({
      projects: [project('p-api', 'api'), project('p-web', 'web')],
      mounts: [{ projectId: 'p-api' as ProjectId }],
    });

    await materializeDeclaredProjects({
      get,
      sessionId: SESSION_ID,
      stepName: 'Implement',
      declarationText: 'api and web both change',
    });

    expect(materializeProject).toHaveBeenCalledTimes(1);
    expect(materializeProject).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'p-web' }),
    );
  });

  it('leaves a single-project workspace to the first-turn hook', async () => {
    const { get, materializeProject } = harness({ projects: [project('p-api', 'api')] });

    await materializeDeclaredProjects({
      get,
      sessionId: SESSION_ID,
      stepName: 'Implement',
      declarationText: 'change the api',
    });

    expect(materializeProject).not.toHaveBeenCalled();
  });
});
