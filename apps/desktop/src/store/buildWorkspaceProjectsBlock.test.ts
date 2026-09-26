import { describe, expect, it } from 'vitest';
import type { IsoDateTime, Project, ProjectId, WorkspaceId } from '@goodboy/types';
import { buildWorkspaceProjectsBlock } from './buildWorkspaceProjectsBlock';

const NOW = '2026-09-25T00:00:00.000Z' as IsoDateTime;

const project = (changes: Partial<Project>): Project => ({
  id: 'project-ledger' as ProjectId,
  workspaceId: 'workspace-harborline' as WorkspaceId,
  name: 'ledger-core',
  rootPath: '/repos/ledger-core',
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
  },
  createdAt: NOW,
  updatedAt: NOW,
  ...changes,
});

describe('buildWorkspaceProjectsBlock', () => {
  it('is empty without projects', () => {
    expect(buildWorkspaceProjectsBlock({ projects: [] })).toBe('');
  });

  it('lists starred projects first with their descriptions for the planner and orchestrator', () => {
    const block = buildWorkspaceProjectsBlock({
      projects: [
        project({ id: 'project-relay' as ProjectId, name: 'notify-relay', kind: 'folder' }),
        project({ starredAt: NOW, description: 'Settles payments and writes the ledger' }),
      ],
    });

    expect(block).toBe(
      [
        '[workspace-projects]',
        'The workspace has these projects:',
        '- ledger-core (repo) | starred, the owner works here most | Settles payments and writes the ledger',
        '- notify-relay (folder)',
        'When a request names no project, look in starred projects first.',
        '[/workspace-projects]',
      ].join('\n'),
    );
  });
});
