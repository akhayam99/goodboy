// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PullRequestPortError, STALE_HEAD_MESSAGE, isPullRequestPortError } from '@goodboy/core';
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
    await transport.merge({ method: 'rebase', expectedHeadSha: null });

    expect(h.updateState).toHaveBeenCalledWith({ ...target, stateEvent: 'close' });
    expect(h.merge).toHaveBeenCalledWith({ ...target, method: 'rebase', expectedHeadSha: null });
  });

  it('hands the reviewed head to the merge command', async () => {
    const transport = gitlabPullRequestTransport(target);

    await transport.merge({ method: 'squash', expectedHeadSha: '6c20f48a9e1d' });

    expect(h.merge).toHaveBeenCalledWith({
      ...target,
      method: 'squash',
      expectedHeadSha: '6c20f48a9e1d',
    });
  });

  it('names a moved head as stale_head with the refresh and review message', async () => {
    const transport = gitlabPullRequestTransport(target);
    h.merge.mockRejectedValue(
      new CommandError({
        kind: 'stale_head',
        message:
          'the branch changed after it was reviewed: SHA does not match HEAD of source branch',
      }),
    );

    const error = await transport.merge({ method: 'squash', expectedHeadSha: '6c20f48a9e1d' }).then(
      () => null,
      (caught: unknown) => (isPullRequestPortError(caught) ? caught : null),
    );

    expect(error?.kind).toBe('stale_head');
    expect(error?.message).toBe(STALE_HEAD_MESSAGE);
    expect(error?.details).toContain('SHA does not match HEAD');
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
    ['bad_credentials', 401, 'denied', '401 Unauthorized'],
    ['denied', 403, 'denied', '{"message":"403 Forbidden"}'],
    ['not_found', 404, 'failed', '404 Project Not Found'],
    ['rate_limited', 429, 'rate_limited', 'Retry later'],
    ['network', 0, 'network', 'error sending request'],
    ['timeout', null, 'network', 'request timed out: deadline'],
    ['failed', 422, 'failed', 'Unprocessable'],
    ['failed', 500, 'failed', 'boom'],
    ['failed', 502, 'failed', '<html>Bad Gateway</html>'],
  ] as const)(
    'turns the Rust failure kind %s (status %s) into a %s port error that keeps the host text',
    async (failureKind, status, portKind, detail) => {
      const transport = gitlabPullRequestTransport(target);
      h.updateMr.mockRejectedValue(
        new CommandError({
          kind: 'http',
          message: `http error ${status}: ${detail}`,
          failure: { kind: failureKind, status, retryAfterSeconds: null, detail },
        }),
      );

      const error = await transport.updateMergeRequest({ title: 'x' }).then(
        () => null,
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(PullRequestPortError);
      expect(error).toMatchObject({ kind: portKind, details: detail });
    },
  );

  it('reads an error that carries no failure kind as failed', async () => {
    const transport = gitlabPullRequestTransport(target);
    h.updateMr.mockRejectedValue(
      new CommandError({ kind: 'shape', message: 'invalid response shape: x' }),
    );

    const error = await transport.updateMergeRequest({ title: 'x' }).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(error).toMatchObject({ kind: 'failed', details: 'invalid response shape: x' });
  });

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
    h.getMr.mockRejectedValue(
      new CommandError({
        kind: 'http',
        message: 'http error 500: ',
        failure: { kind: 'failed', status: 500, retryAfterSeconds: null, detail: '' },
      }),
    );

    await expect(transport.readMergeRequest()).rejects.toMatchObject({
      message: 'GitLab did not answer',
      details: '',
    });
  });
});
