// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PullRequestPortError } from '@goodboy/core';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { CommandError } from '../../../shared/lib/invokeCommand';

const h = vi.hoisted(() => ({
  getMr: vi.fn(),
  commits: vi.fn(),
  diff: vi.fn(),
  approvals: vi.fn(),
  jobs: vi.fn(),
  updateMr: vi.fn(),
  updateState: vi.fn(),
  merge: vi.fn(),
  settings: vi.fn(),
  users: vi.fn(),
}));

vi.mock('./client', () => ({
  gitlabGetMr: h.getMr,
  gitlabMrCommits: h.commits,
  gitlabMrDiff: h.diff,
  gitlabMrApprovalState: h.approvals,
  gitlabMrPipelineJobs: h.jobs,
  gitlabUpdateMr: h.updateMr,
  gitlabUpdateMrState: h.updateState,
  gitlabMergeMr: h.merge,
  gitlabProjectMergeMethods: h.settings,
  gitlabSearchProjectUsers: h.users,
}));

import { gitlabPullRequestTransport } from './gitlabPullRequestTransport';

const WORKSPACE = 'ws-1' as WorkspaceId;
const PROJECT = 'project-1' as ProjectId;

const target = {
  workspaceId: WORKSPACE,
  projectId: PROJECT,
  host: 'https://gitlab.com',
  projectPath: 'harborline/payments-api',
  mrIid: 42,
};

const project = {
  workspaceId: WORKSPACE,
  projectId: PROJECT,
  host: 'https://gitlab.com',
  projectPath: 'harborline/payments-api',
};

beforeEach(() => {
  for (const fn of Object.values(h)) {
    fn.mockReset();
    fn.mockResolvedValue(undefined);
  }
});

describe('gitlabPullRequestTransport', () => {
  it('reads each fact of the merge request with its target', async () => {
    const transport = gitlabPullRequestTransport(target);
    h.diff.mockResolvedValue('diff --git a/x b/x');

    await transport.readMergeRequest();
    await transport.readCommits();
    await transport.readApprovals();
    await transport.readPipelineJobs();
    expect(await transport.readChanges()).toBe('diff --git a/x b/x');

    expect(h.getMr).toHaveBeenCalledWith(target);
    expect(h.commits).toHaveBeenCalledWith(target);
    expect(h.approvals).toHaveBeenCalledWith(target);
    expect(h.jobs).toHaveBeenCalledWith(target);
    expect(h.diff).toHaveBeenCalledWith(
      WORKSPACE,
      'https://gitlab.com',
      'harborline/payments-api',
      42,
      PROJECT,
    );
  });

  it('sends only the fields of an update', async () => {
    const transport = gitlabPullRequestTransport(target);

    await transport.updateMergeRequest({ description: 'New body' });
    await transport.updateMergeRequest({ title: 'T', reviewerIds: [] });

    expect(h.updateMr).toHaveBeenNthCalledWith(1, { ...target, description: 'New body' });
    expect(h.updateMr).toHaveBeenNthCalledWith(2, { ...target, title: 'T', reviewerIds: [] });
  });

  it('closes and reopens through the state command and merges with the method', async () => {
    const transport = gitlabPullRequestTransport(target);

    await transport.setState({ stateEvent: 'close' });
    await transport.merge({ method: 'rebase' });

    expect(h.updateState).toHaveBeenCalledWith({ ...target, stateEvent: 'close' });
    expect(h.merge).toHaveBeenCalledWith(
      WORKSPACE,
      'https://gitlab.com',
      'harborline/payments-api',
      42,
      PROJECT,
      'rebase',
    );
  });

  it('reads the project rules and searches its users without the merge request number', async () => {
    const transport = gitlabPullRequestTransport(target);

    await transport.projectMergeSettings();
    await transport.searchUsers({ query: 'ken' });

    expect(h.settings).toHaveBeenCalledWith(project);
    expect(h.users).toHaveBeenCalledWith({ ...project, query: 'ken' });
  });

  it('leaves the project binding out when there is none', async () => {
    const transport = gitlabPullRequestTransport({
      workspaceId: WORKSPACE,
      host: 'https://gitlab.com',
      projectPath: 'harborline/payments-api',
      mrIid: 42,
    });

    await transport.readMergeRequest();

    expect(h.getMr).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      host: 'https://gitlab.com',
      projectPath: 'harborline/payments-api',
      mrIid: 42,
    });
  });

  it.each([
    [
      'http',
      'http error 403: {"message":"403 Forbidden"}',
      'denied',
      '{"message":"403 Forbidden"}',
    ],
    ['http', 'http error 401: 401 Unauthorized', 'denied', '401 Unauthorized'],
    ['http', 'http error 429: Retry later', 'rate_limited', 'Retry later'],
    ['http', 'http error 0: error sending request', 'network', 'error sending request'],
    ['http', 'http error 500: boom', 'failed', 'boom'],
    ['timeout', 'request timed out: deadline', 'network', 'request timed out: deadline'],
    [
      'no_token',
      'no personal API key stored for workspace ws-1',
      'denied',
      'no personal API key stored for workspace ws-1',
    ],
    ['shape', 'invalid response shape: x', 'failed', 'invalid response shape: x'],
  ] as const)(
    'turns a %s failure %j into a %s error that keeps the host text',
    async (kind, message, portKind, details) => {
      const transport = gitlabPullRequestTransport(target);
      h.updateMr.mockRejectedValue(new CommandError({ kind, message }));

      const error = await transport.updateMergeRequest({ title: 'x' }).then(
        () => null,
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(PullRequestPortError);
      expect((error as PullRequestPortError).kind).toBe(portKind);
      expect((error as PullRequestPortError).details).toBe(details);
    },
  );

  it('keeps a typed error as it is and wraps a plain one as failed', async () => {
    const transport = gitlabPullRequestTransport(target);
    const typed = new PullRequestPortError({ kind: 'denied', message: 'm', details: 'd' });
    h.getMr.mockRejectedValueOnce(typed);
    h.getMr.mockRejectedValueOnce(new Error('socket closed'));

    await expect(transport.readMergeRequest()).rejects.toBe(typed);
    const plain = await transport.readMergeRequest().then(
      () => null,
      (caught: unknown) => caught,
    );
    expect((plain as PullRequestPortError).kind).toBe('failed');
    expect((plain as PullRequestPortError).details).toBe('socket closed');
  });

  it('gives an empty body a plain message', async () => {
    const transport = gitlabPullRequestTransport(target);
    h.getMr.mockRejectedValue(new CommandError({ kind: 'http', message: 'http error 500: ' }));

    await expect(transport.readMergeRequest()).rejects.toMatchObject({
      message: 'GitLab did not answer',
      details: '',
    });
  });
});
