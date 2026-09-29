// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, Project, ProjectId, WorkspaceId } from '@goodboy/types';
import { groupProjects } from './groupProjects';

const NOW = '2026-08-22T00:00:00.000Z' as IsoDateTime;
const WORKSPACE_ID = 'ws-1' as WorkspaceId;

const project = ({
  id,
  name,
  starred = false,
}: {
  readonly id: string;
  readonly name: string;
  readonly starred?: boolean;
}): Project => ({
  id: id as ProjectId,
  workspaceId: WORKSPACE_ID,
  name,
  rootPath: `/repos/${id}`,
  kind: 'repo',
  overrides: {
    defaultProviderId: null,
    defaultBranchPrefix: null,
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
    afterMerge: null,
  },
  createdAt: NOW,
  updatedAt: NOW,
  ...(starred ? { starredAt: NOW } : {}),
});

describe('groupProjects', () => {
  it('splits starred from the rest, each sorted alphabetically', () => {
    const projects = [
      project({ id: 'p1', name: 'payments-api' }),
      project({ id: 'p2', name: 'ledger-core', starred: true }),
      project({ id: 'p3', name: 'admin-console' }),
      project({ id: 'p4', name: 'storefront-web', starred: true }),
    ];

    const groups = groupProjects(projects);

    expect(groups.starred.map((p) => p.name)).toEqual(['ledger-core', 'storefront-web']);
    expect(groups.all.map((p) => p.name)).toEqual(['admin-console', 'payments-api']);
  });

  it('never lists a starred project a second time in All', () => {
    const projects = [project({ id: 'p1', name: 'ledger-core', starred: true })];

    const groups = groupProjects(projects);

    expect(groups.all).toEqual([]);
    expect(groups.starred).toHaveLength(1);
  });
});
