import { describe, expect, it } from 'vitest';
import type { IsoDateTime, Project, ProjectId, WorkspaceId } from '@goodboy/types';
import { primaryProjectRoot } from './primaryProjectRoot';

const NOW = '2026-09-25T00:00:00.000Z' as IsoDateTime;
const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;

const project = (changes: Partial<Project>): Project => ({
  id: 'project-ledger' as ProjectId,
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: '/repos/ledger-core',
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
    attributionFooter: null,
    replyVoice: null,
    replyStyleNote: null,
    replyTemplateFixed: null,
    replyTemplateNoChange: null,
    resolveOnGithub: null,
    resolveCommitStyle: null,
  },
  createdAt: NOW,
  updatedAt: NOW,
  ...changes,
});

const ledger = project({});
const payments = project({
  id: 'project-payments' as ProjectId,
  name: 'payments-api',
  rootPath: '/repos/payments-api',
});
const runbooks = project({
  id: 'project-runbooks' as ProjectId,
  name: 'runbooks',
  rootPath: '/repos/runbooks',
  kind: 'folder',
});

describe('primaryProjectRoot', () => {
  it('picks the first repository when nothing is starred', () => {
    expect(
      primaryProjectRoot({ projects: [runbooks, ledger, payments], workspaceId: WORKSPACE_ID }),
    ).toBe('/repos/ledger-core');
  });

  it('picks a starred repository before the first linked one', () => {
    expect(
      primaryProjectRoot({
        projects: [ledger, { ...payments, starredAt: NOW }],
        workspaceId: WORKSPACE_ID,
      }),
    ).toBe('/repos/payments-api');
  });

  it('still prefers a repository over a starred folder', () => {
    expect(
      primaryProjectRoot({
        projects: [{ ...runbooks, starredAt: NOW }, ledger],
        workspaceId: WORKSPACE_ID,
      }),
    ).toBe('/repos/ledger-core');
  });

  it('is null without projects in the workspace', () => {
    expect(primaryProjectRoot({ projects: undefined, workspaceId: WORKSPACE_ID })).toBeNull();
  });
});
