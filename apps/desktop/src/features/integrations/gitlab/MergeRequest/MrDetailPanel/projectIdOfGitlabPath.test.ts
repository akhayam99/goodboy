// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aProject, aWorkspace } from '@goodboy/types/testing';
import { projectIdOfGitlabPath } from './projectIdOfGitlabPath';

const HARBORLINE = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const NORTHWIND = aWorkspace({ name: 'Northwind', slug: 'northwind' });

const LEDGER = aProject({
  workspaceId: HARBORLINE.id,
  name: 'ledger-core',
  remoteUrl: 'ssh://gitlab.com/harborline/ledger-core.git',
});
const RELAY = aProject({
  workspaceId: HARBORLINE.id,
  name: 'notify-relay',
  remoteUrl: 'https://gitlab.com/Harborline/notify-relay.git',
});
const NORTHWIND_LEDGER = aProject({
  workspaceId: NORTHWIND.id,
  name: 'ledger-core',
  remoteUrl: 'ssh://gitlab.com/harborline/ledger-core.git',
});

describe('projectIdOfGitlabPath', () => {
  it('finds the project whose remote is that repository in that workspace', () => {
    expect(
      projectIdOfGitlabPath({
        projects: [NORTHWIND_LEDGER, RELAY, LEDGER],
        workspaceId: HARBORLINE.id,
        projectPath: 'harborline/ledger-core',
      }),
    ).toBe(LEDGER.id);
  });

  it('ignores the case of the path', () => {
    expect(
      projectIdOfGitlabPath({
        projects: [RELAY],
        workspaceId: HARBORLINE.id,
        projectPath: 'harborline/notify-relay',
      }),
    ).toBe(RELAY.id);
  });

  it('names no project when none of the workspace owns the repository', () => {
    expect(
      projectIdOfGitlabPath({
        projects: [NORTHWIND_LEDGER],
        workspaceId: HARBORLINE.id,
        projectPath: 'harborline/ledger-core',
      }),
    ).toBeUndefined();
  });
});
