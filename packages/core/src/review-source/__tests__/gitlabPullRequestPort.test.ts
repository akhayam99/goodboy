import { describe, expect, it } from 'vitest';
import { gitlabDraftTitle, stripGitlabDraftPrefix } from '../gitlabDraftTitle';
import {
  gitlabJobConclusion,
  gitlabMergeMethodsOf,
  gitlabMergeableOf,
  gitlabPullRequestPort,
  gitlabReviewDecisionOf,
  gitlabReviewersOf,
  gitlabStateKindOf,
} from '../gitlabPullRequestPort';
import { PullRequestPortError, PullRequestPortUnsupported } from '../pullRequestPort';
import { REVIEW_SOURCE_CAPABILITIES } from '../types';
import {
  APPROVALS_JSON,
  GITLAB_MR_URL,
  KENJI,
  MR_JSON,
  NADIA,
  OMAR,
  PRIYA,
  fakeGitlabTransport,
  type TransportOverrides,
} from './gitlabPullRequestFixture';

const portOf = (overrides: TransportOverrides = {}) => {
  const fake = fakeGitlabTransport(overrides);
  return {
    fake,
    port: gitlabPullRequestPort({ transport: fake.transport, mrUrl: GITLAB_MR_URL }),
  };
};

describe('gitlab job conclusions', () => {
  it.each([
    ['success', 'success'],
    ['failed', 'failure'],
    ['running', 'pending'],
    ['pending', 'pending'],
    ['created', 'pending'],
    ['canceled', 'cancelled'],
    ['skipped', 'skipped'],
    ['manual', 'neutral'],
    ['something-new', 'unknown'],
    ['', 'unknown'],
  ] as const)('reads %s as %s', (status, conclusion) => {
    expect(gitlabJobConclusion({ status })).toBe(conclusion);
  });

  it('does not count a failed job that is allowed to fail as a failure', () => {
    expect(gitlabJobConclusion({ status: 'failed', allowFailure: true })).toBe('neutral');
    expect(gitlabJobConclusion({ status: 'success', allowFailure: true })).toBe('success');
  });
});

describe('gitlab state mapping', () => {
  it.each([
    ['opened', false, 'open'],
    ['opened', true, 'draft'],
    ['merged', false, 'merged'],
    ['merged', true, 'merged'],
    ['closed', false, 'closed'],
    ['locked', false, 'queued'],
  ] as const)('reads %s with draft %s as %s', (state, draft, kind) => {
    expect(gitlabStateKindOf({ state, draft })).toBe(kind);
  });

  it.each([
    [true, 'can_be_merged', false],
    [false, 'cannot_be_merged', false],
    [false, 'checking', null],
    [false, 'unchecked', null],
    [false, 'cannot_be_merged_recheck', null],
    [false, 'can_be_merged', true],
    [false, null, true],
  ] as const)('reads conflicts %s and status %s as mergeable %s', (hasConflicts, status, value) => {
    expect(gitlabMergeableOf({ hasConflicts, mergeStatus: status })).toBe(value);
  });

  it('reads approvals as approved only when someone approved and none are left', () => {
    expect(gitlabReviewDecisionOf({ approvals: null })).toBeNull();
    expect(gitlabReviewDecisionOf({ approvals: APPROVALS_JSON })).toBe('review_required');
    expect(
      gitlabReviewDecisionOf({ approvals: { approvalsLeft: 0, approvedBy: [{ user: KENJI }] } }),
    ).toBe('approved');
    expect(gitlabReviewDecisionOf({ approvals: { approvalsLeft: 0, approvedBy: [] } })).toBe(
      'review_required',
    );
  });

  it('never reads changes requested, GitLab has no such state', () => {
    const states = [
      gitlabReviewDecisionOf({ approvals: null }),
      gitlabReviewDecisionOf({ approvals: APPROVALS_JSON }),
      gitlabReviewDecisionOf({ approvals: { approvalsLeft: 0, approvedBy: [{ user: KENJI }] } }),
    ];
    expect(states).not.toContain('changes_requested');
  });
});

describe('gitlab reviewers', () => {
  it('marks a listed reviewer approved when they approved and pending otherwise', () => {
    expect(
      gitlabReviewersOf({ reviewers: [OMAR, KENJI], approvals: APPROVALS_JSON }).map((entry) => [
        entry.person.login,
        entry.state,
      ]),
    ).toEqual([
      ['omar-t', 'pending'],
      ['kenji-w', 'approved'],
    ]);
  });

  it('adds an approver who was never asked and matches logins without case', () => {
    const upper = { ...KENJI, username: 'Kenji-W' };
    expect(
      gitlabReviewersOf({
        reviewers: [upper],
        approvals: { approvalsLeft: 0, approvedBy: [{ user: KENJI }, { user: PRIYA }] },
      }).map((entry) => [entry.person.login, entry.state]),
    ).toEqual([
      ['Kenji-W', 'approved'],
      ['priya-n', 'approved'],
    ]);
  });

  it('keeps the reviewers without approvals as pending', () => {
    expect(
      gitlabReviewersOf({ reviewers: [OMAR], approvals: null }).map((entry) => entry.state),
    ).toEqual(['pending']);
  });
});

describe('gitlab merge methods', () => {
  it.each([
    ['merge', 'default_off', ['merge', 'squash'], ['rebase']],
    ['rebase_merge', 'default_off', ['merge', 'squash', 'rebase'], []],
    ['ff', 'default_off', ['rebase', 'squash'], ['merge']],
    ['merge', 'never', ['merge'], ['squash', 'rebase']],
    ['ff', 'never', ['rebase'], ['squash', 'merge']],
    ['merge', 'always', ['merge', 'squash'], ['rebase']],
  ] as const)(
    'offers %s with squash %s as %j and forbids %j',
    (mergeMethod, squashOption, allowed, forbidden) => {
      const { mergeMethods, mergeMethodReasons } = gitlabMergeMethodsOf({
        settings: { mergeMethod, squashOption, onlyAllowMergeIfPipelineSucceeds: false },
      });
      expect(mergeMethods).toEqual(allowed);
      expect(Object.keys(mergeMethodReasons).sort()).toEqual([...forbidden].sort());
      for (const reason of Object.values(mergeMethodReasons)) {
        expect(reason).toBe('Set by the project');
      }
    },
  );

  it('treats a project with no squash option as allowing squash', () => {
    expect(
      gitlabMergeMethodsOf({
        settings: {
          mergeMethod: 'merge',
          squashOption: null,
          onlyAllowMergeIfPipelineSucceeds: false,
        },
      }).mergeMethods,
    ).toContain('squash');
  });
});

describe('gitlab draft titles', () => {
  it.each([
    ['Draft: Stop retried webhooks', 'Stop retried webhooks'],
    ['[WIP] Stop retried webhooks', 'Stop retried webhooks'],
    ['(draft) Stop retried webhooks', 'Stop retried webhooks'],
    ['Stop retried webhooks', 'Stop retried webhooks'],
    ['Drafting the retry policy', 'Drafting the retry policy'],
  ])('strips the prefix of %s', (title, bare) => {
    expect(stripGitlabDraftPrefix({ title })).toBe(bare);
  });

  it('adds the prefix once and removes it on demand', () => {
    expect(gitlabDraftTitle({ title: 'Fix', isDraft: true })).toBe('Draft: Fix');
    expect(gitlabDraftTitle({ title: 'Draft: Fix', isDraft: true })).toBe('Draft: Fix');
    expect(gitlabDraftTitle({ title: 'Draft: Fix', isDraft: false })).toBe('Fix');
    expect(gitlabDraftTitle({ title: 'Draft:', isDraft: true })).toBe('Draft:');
  });
});

describe('gitlabPullRequestPort read', () => {
  it('builds the view of a merge request from the payloads', async () => {
    const { port } = portOf();
    const view = await port.read();
    expect(view).toMatchObject({
      host: 'gitlab',
      number: 42,
      title: 'Stop retried webhooks posting a second credit',
      body: 'Key the guard on the event id.',
      url: GITLAB_MR_URL,
      state: 'open',
      isDraft: false,
      baseBranch: 'main',
      headBranch: 'hl/fix-duplicate-credit',
      headSha: '6c20f48a9e1',
      createdAt: '2026-09-26T08:00:00Z',
      mergeable: true,
      reviewDecision: 'review_required',
      mergedAt: null,
    });
    expect(view.author).toEqual({ login: 'nadia-p', name: 'Nadia Petrova', avatarUrl: null });
    expect(port.nouns).toEqual({ long: 'merge request', short: 'MR', numberPrefix: '!' });
  });

  it('lists the first seven files out of the diff and counts all of them', async () => {
    const view = await portOf().port.read();
    expect(view.files.count).toBe(8);
    expect(view.files.first).toHaveLength(7);
    expect(view.files.first[0]).toEqual({
      path: 'src/ledger/ledgerClient.ts',
      additions: 2,
      deletions: 1,
    });
  });

  it('lists the commits oldest first', async () => {
    const view = await portOf().port.read();
    expect(view.commits.map((commit) => commit.headline)).toEqual([
      'Key the credit guard on the event id',
      'Drop the seenEvents read',
    ]);
    expect(view.commits[1]).toEqual({
      sha: 'a41c9e2b7d3f',
      headline: 'Drop the seenEvents read',
      committedAt: '2026-10-03T12:00:00Z',
      author: 'Nadia Petrova',
    });
  });

  it('reads the checks from the pipeline jobs', async () => {
    const view = await portOf().port.read();
    expect(view.checks).toEqual({
      read: 'ok',
      error: null,
      runs: [
        {
          name: 'unit',
          conclusion: 'success',
          detailsUrl: 'https://gitlab.com/harborline/payments-api/-/jobs/77',
          durationMs: 83500,
        },
        {
          name: 'lint',
          conclusion: 'failure',
          detailsUrl: 'https://gitlab.com/harborline/payments-api/-/jobs/78',
          durationMs: 12000,
        },
      ],
    });
  });

  it('says denied when the pipelines are out of reach', async () => {
    const view = await portOf({ checks: null }).port.read();
    expect(view.checks).toEqual({ read: 'denied', error: null, runs: [] });
  });

  it('reads an MR with no pipeline as no runs, not as a failure', async () => {
    const view = await portOf({ checks: { pipeline: null, jobs: [] } }).port.read();
    expect(view.checks).toEqual({ read: 'ok', error: null, runs: [] });
  });

  it('keeps the host text when the jobs read fails', async () => {
    const fake = fakeGitlabTransport();
    const port = gitlabPullRequestPort({
      transport: {
        ...fake.transport,
        readPipelineJobs: async () => {
          throw new PullRequestPortError({
            kind: 'denied',
            message: '403 Forbidden',
            details: '403 Forbidden',
          });
        },
      },
      mrUrl: GITLAB_MR_URL,
    });
    expect((await port.read()).checks).toEqual({
      read: 'denied',
      error: '403 Forbidden',
      runs: [],
    });
    const failing = gitlabPullRequestPort({
      transport: {
        ...fake.transport,
        readPipelineJobs: async () => {
          throw new Error('socket hang up');
        },
      },
      mrUrl: GITLAB_MR_URL,
    });
    expect((await failing.read()).checks).toEqual({
      read: 'failed',
      error: 'socket hang up',
      runs: [],
    });
  });

  it('reads the project merge methods with the reasons', async () => {
    const view = await portOf({
      settings: {
        mergeMethod: 'merge',
        squashOption: 'never',
        onlyAllowMergeIfPipelineSucceeds: false,
      },
    }).port.read();
    expect(view.mergeMethods).toEqual(['merge']);
    expect(view.mergeMethodReasons).toEqual({
      squash: 'Set by the project',
      rebase: 'Set by the project',
    });
  });

  it('keeps reading when the optional reads fail', async () => {
    const fake = fakeGitlabTransport();
    const broken = async (): Promise<never> => {
      throw new Error('boom');
    };
    const port = gitlabPullRequestPort({
      transport: {
        ...fake.transport,
        readApprovals: broken,
        readCommits: broken,
        readChanges: broken,
        projectMergeSettings: broken,
      },
      mrUrl: GITLAB_MR_URL,
    });
    const view = await port.read();
    expect(view.reviewDecision).toBeNull();
    expect(view.commits).toEqual([]);
    expect(view.files).toEqual({ count: 0, first: [] });
    expect(view.mergeMethods).toEqual(['merge', 'squash']);
  });

  it('shows a draft with its prefix stripped from the title', async () => {
    const view = await portOf({
      mr: { ...MR_JSON, draft: true, title: 'Draft: Stop retried webhooks' },
    }).port.read();
    expect(view.isDraft).toBe(true);
    expect(view.state).toBe('draft');
    expect(view.title).toBe('Stop retried webhooks');
  });

  it('turns a failed merge request read into a typed error', async () => {
    const error = await portOf({ readError: new Error('http error 404: not found') })
      .port.read()
      .then(
        () => null,
        (caught: unknown) => caught,
      );
    expect(error).toBeInstanceOf(PullRequestPortError);
    expect((error as PullRequestPortError).details).toBe('http error 404: not found');
    expect((error as PullRequestPortError).kind).toBe('failed');
  });
});

describe('gitlabPullRequestPort writes', () => {
  it('edits the description only', async () => {
    const { port, fake } = portOf();
    await port.updateBody({ body: 'A new body' });
    expect(fake.updates).toEqual([{ description: 'A new body' }]);
  });

  it('edits the title and keeps the draft prefix of a draft', async () => {
    const draft = portOf({ mr: { ...MR_JSON, draft: true, title: 'Draft: Old' } });
    await draft.port.updateTitle({ title: 'A new title' });
    expect(draft.fake.updates).toEqual([{ title: 'Draft: A new title' }]);

    const ready = portOf();
    await ready.port.updateTitle({ title: 'A new title' });
    expect(ready.fake.updates).toEqual([{ title: 'A new title' }]);
  });

  it('marks ready and converts to a draft through the title prefix', async () => {
    const draft = portOf({ mr: { ...MR_JSON, draft: true, title: 'Draft: Stop it' } });
    await draft.port.setDraft({ isDraft: false });
    expect(draft.fake.updates).toEqual([{ title: 'Stop it' }]);

    const ready = portOf();
    await ready.port.setDraft({ isDraft: true });
    expect(ready.fake.updates).toEqual([{ title: `Draft: ${MR_JSON.title}` }]);
  });

  it('closes and reopens through the state event', async () => {
    const { port, fake } = portOf();
    await port.close();
    await port.reopen();
    expect(fake.states).toEqual(['close', 'reopen']);
  });

  it('passes the merge method through', async () => {
    const { port, fake } = portOf();
    await port.merge({ method: 'squash' });
    await port.merge({ method: 'rebase' });
    expect(fake.merges).toEqual(['squash', 'rebase']);
  });

  it('searches the project users as reviewers', async () => {
    const { port, fake } = portOf();
    const people = await port.searchReviewers({ query: 'ken' });
    expect(fake.searches).toEqual(['ken']);
    expect(people.map((person) => person.login)).toEqual(['kenji-w', 'priya-n', 'omar-t']);
  });

  it('adds reviewers to the ones already asked, by id', async () => {
    const { port, fake } = portOf({ mr: { ...MR_JSON, reviewers: [OMAR] } });
    await port.requestReviewers({ logins: [' kenji-w ', ''] });
    expect(fake.updates).toEqual([{ reviewerIds: [4, 7] }]);
  });

  it('does not ask twice for a reviewer who is already asked', async () => {
    const { port, fake } = portOf({ mr: { ...MR_JSON, reviewers: [KENJI] } });
    await port.requestReviewers({ logins: ['KENJI-W'] });
    expect(fake.updates).toEqual([{ reviewerIds: [7] }]);
  });

  it('skips an empty request', async () => {
    const { port, fake } = portOf();
    await port.requestReviewers({ logins: [' '] });
    expect(fake.updates).toEqual([]);
  });

  it('refuses a reviewer the project does not know', async () => {
    const { port, fake } = portOf({ users: [NADIA] });
    await expect(port.requestReviewers({ logins: ['ghost'] })).rejects.toMatchObject({
      kind: 'failed',
      message: 'No GitLab user named ghost in this project',
    });
    expect(fake.updates).toEqual([]);
  });

  it('wraps an untyped write failure and keeps its text', async () => {
    const { port } = portOf({ writeError: new Error('http error 422: title is invalid') });
    const error = await port.updateBody({ body: 'x' }).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(PullRequestPortError);
    expect((error as PullRequestPortError).details).toBe('http error 422: title is invalid');
  });

  it('keeps a typed failure as it is', async () => {
    const typed = new PullRequestPortError({
      kind: 'denied',
      message: 'the token lacks the api scope',
      details: '403',
    });
    const { port } = portOf({ writeError: typed });
    await expect(port.close()).rejects.toBe(typed);
  });

  it('answers unsupported when a capability is off', async () => {
    const fake = fakeGitlabTransport();
    const port = gitlabPullRequestPort({
      transport: fake.transport,
      mrUrl: GITLAB_MR_URL,
      capabilities: { ...REVIEW_SOURCE_CAPABILITIES.gitlab, canSetDraft: false },
    });
    await expect(port.setDraft({ isDraft: true })).rejects.toBeInstanceOf(
      PullRequestPortUnsupported,
    );
    expect(fake.updates).toEqual([]);
  });
});
