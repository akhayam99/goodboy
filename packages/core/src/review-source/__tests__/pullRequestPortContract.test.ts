import { describe, expect, it } from 'vitest';
import type { PrMergeMethod, PullRequestView } from '@goodboy/types';
import { bitbucketPullRequestPort } from '../bitbucketPullRequestPort';
import { githubPullRequestPort } from '../githubPullRequestPort';
import { gitlabPullRequestPort } from '../gitlabPullRequestPort';
import {
  PullRequestPortError,
  PullRequestPortUnsupported,
  STALE_HEAD_MESSAGE,
  isPullRequestPortError,
  type PullRequestFailureKind,
  type PullRequestPort,
} from '../pullRequestPort';
import { REVIEW_SOURCE_CAPABILITIES, type ReviewSourceCapabilities } from '../types';
import { BITBUCKET_PR_URL, fakeBitbucketTransport } from './bitbucketPullRequestFixture';
import { GITHUB_PR_REPO, GITHUB_PR_URL, failure, githubRunner } from './githubPullRequestFixture';
import { GITLAB_MR_URL, fakeGitlabTransport } from './gitlabPullRequestFixture';

type Built = Readonly<{
  port: PullRequestPort;
  mergeMethodOf: () => PrMergeMethod | null;
  mergeHeadOf: () => string | null;
}>;

type BuildParams = Readonly<{
  headNow?: string;
  failWith?: Readonly<{ text: string; kind: PullRequestFailureKind }>;
  capabilities?: ReviewSourceCapabilities;
}>;

type Failure = readonly [label: string, text: string, kind: PullRequestFailureKind];

type Adapter = Readonly<{
  name: string;
  noun: string;
  reviewers: ReadonlyArray<readonly [string, string]>;
  resolves: PullRequestView['resolves'];
  failures: ReadonlyArray<Failure>;
  alwaysUnsupported: ReadonlyArray<string>;
  build: (params: BuildParams) => Built;
}>;

const NO_CAPABILITIES: ReviewSourceCapabilities = {
  ...REVIEW_SOURCE_CAPABILITIES.local,
  canReply: false,
  canResolve: false,
};

const REVIEWED_HEAD = '6c20f48a9e1d';

const MOVED_HEAD = '9f3e2d1c0b8a';

const GITHUB_STALE_HEAD =
  'GraphQL: Head branch was modified. Review and try the merge again. (mergePullRequest)';

const FLAG_METHOD: Readonly<Record<string, PrMergeMethod>> = {
  '--squash': 'squash',
  '--merge': 'merge',
  '--rebase': 'rebase',
};

const GITHUB_FAILURES: ReadonlyArray<Failure> = [
  ['denied', 'GraphQL: Resource not accessible by personal access token', 'denied'],
  ['rate limited', 'API rate limit exceeded for user', 'rate_limited'],
  ['offline', 'dial tcp: lookup api.github.com: no such host', 'network'],
  ['rejected', 'Pull request is in clean status', 'failed'],
];

const BITBUCKET_FAILURES: ReadonlyArray<Failure> = [
  ['denied', 'Your credentials lack one or more required privilege scopes.', 'denied'],
  ['rate limited', 'Rate limit for this resource has been exceeded', 'rate_limited'],
  ['offline', 'The request did not reach Bitbucket', 'network'],
  ['rejected', 'Merge strategy squash is not allowed for this repository', 'failed'],
];

const BITBUCKET_STRATEGY_METHOD: Readonly<Record<string, PrMergeMethod>> = {
  squash: 'squash',
  merge_commit: 'merge',
  rebase_merge: 'rebase',
};

const bitbucket: Adapter = {
  name: 'bitbucket',
  noun: 'pull request',
  reviewers: [
    ['omar-t', 'changes_requested'],
    ['kenji-w', 'approved'],
    ['priya-n', 'pending'],
  ],
  resolves: [],
  failures: BITBUCKET_FAILURES,
  alwaysUnsupported: ['setDraft', 'reopen'],
  build: ({ failWith, capabilities, headNow }) => {
    const { transport, calls } = fakeBitbucketTransport({
      ...(failWith === undefined ? {} : { failWrites: failWith }),
      ...(headNow === undefined ? {} : { headNow }),
    });
    return {
      port: bitbucketPullRequestPort({
        transport,
        prUrl: BITBUCKET_PR_URL,
        ...(capabilities === undefined ? {} : { capabilities }),
      }),
      mergeMethodOf: () => {
        const strategy = calls.merges[0];
        return strategy === undefined ? null : (BITBUCKET_STRATEGY_METHOD[strategy] ?? null);
      },
      mergeHeadOf: () => calls.mergeHeads[0] ?? null,
    };
  },
};

const github: Adapter = {
  name: 'github',
  noun: 'pull request',
  reviewers: [
    ['omar-t', 'changes_requested'],
    ['kenji-w', 'approved'],
    ['priya-n', 'pending'],
  ],
  resolves: [
    {
      label: '#412',
      url: 'https://github.com/harborline/payments-api/issues/412',
      isClosing: true,
    },
  ],
  failures: GITHUB_FAILURES,
  alwaysUnsupported: [],
  build: ({ failWith, capabilities, headNow }) => {
    const { runner, calls } = githubRunner({
      override: (args) => {
        const pinned = args[args.indexOf('--match-head-commit') + 1];
        if (headNow !== undefined && args.includes('--match-head-commit') && pinned !== headNow) {
          return failure({ stderr: GITHUB_STALE_HEAD });
        }
        return failWith !== undefined && args[0] === 'pr' && args[1] !== 'view'
          ? failure({ stderr: failWith.text })
          : null;
      },
    });
    return {
      port: githubPullRequestPort({
        runner,
        repo: GITHUB_PR_REPO,
        prNumber: 318,
        prUrl: GITHUB_PR_URL,
        ...(capabilities === undefined ? {} : { capabilities }),
      }),
      mergeMethodOf: () => {
        const merge = calls.find((args) => args[0] === 'pr' && args[1] === 'merge');
        const flag = merge?.find((arg) => arg in FLAG_METHOD);
        return flag === undefined ? null : (FLAG_METHOD[flag] ?? null);
      },
      mergeHeadOf: () => {
        const merge = calls.find((args) => args[0] === 'pr' && args[1] === 'merge');
        const at = merge?.indexOf('--match-head-commit') ?? -1;
        return at === -1 ? null : (merge?.[at + 1] ?? null);
      },
    };
  },
};

const gitlab: Adapter = {
  name: 'gitlab',
  noun: 'merge request',
  reviewers: [
    ['omar-t', 'pending'],
    ['kenji-w', 'approved'],
    ['priya-n', 'pending'],
  ],
  resolves: [],
  failures: GITHUB_FAILURES,
  alwaysUnsupported: [],
  build: ({ failWith, capabilities, headNow }) => {
    const fake = fakeGitlabTransport({
      ...(failWith === undefined
        ? {}
        : {
            writeError: new PullRequestPortError({
              kind: failWith.kind,
              message: failWith.text,
              details: failWith.text,
            }),
          }),
      ...(headNow === undefined ? {} : { headNow }),
    });
    return {
      port: gitlabPullRequestPort({
        transport: fake.transport,
        mrUrl: GITLAB_MR_URL,
        ...(capabilities === undefined ? {} : { capabilities }),
      }),
      mergeMethodOf: () => fake.merges[0] ?? null,
      mergeHeadOf: () => fake.mergeHeads[0] ?? null,
    };
  },
};

const ADAPTERS: ReadonlyArray<Adapter> = [github, gitlab, bitbucket];

const isValidView = (view: PullRequestView): boolean =>
  view.number > 0 &&
  view.title !== '' &&
  view.url.startsWith('https://') &&
  view.baseBranch !== '' &&
  view.headBranch !== '' &&
  view.files.first.length <= 7 &&
  view.files.count >= view.files.first.length &&
  view.mergeMethods.length > 0 &&
  ['ok', 'denied', 'failed', 'unsupported'].includes(view.checks.read);

type Write = Readonly<{ name: string; call: (port: PullRequestPort) => Promise<unknown> }>;

const GUARDED_WRITES: ReadonlyArray<Write> = [
  { name: 'updateTitle', call: (port) => port.updateTitle({ title: 'New title' }) },
  { name: 'updateBody', call: (port) => port.updateBody({ body: 'New body' }) },
  { name: 'requestReviewers', call: (port) => port.requestReviewers({ logins: ['kenji-w'] }) },
  { name: 'setDraft', call: (port) => port.setDraft({ isDraft: true }) },
  { name: 'close', call: (port) => port.close() },
  { name: 'reopen', call: (port) => port.reopen() },
];

const WRITES: ReadonlyArray<Write> = [
  ...GUARDED_WRITES,
  { name: 'merge', call: (port) => port.merge({ method: 'squash', expectedHeadSha: null }) },
];

describe.each(ADAPTERS)('pull request port contract on $name', (adapter) => {
  it('reads a valid view and names its nouns', async () => {
    const { port } = adapter.build({});
    const view = await port.read();
    expect(isValidView(view)).toBe(true);
    expect(view.host).toBe(adapter.name);
    expect(port.nouns.long).toBe(adapter.noun);
  });

  it('reads the review state, the closing issues and the first seven files', async () => {
    const view = await adapter.build({}).port.read();
    expect(view.reviewers.map((reviewer) => [reviewer.person.login, reviewer.state])).toEqual(
      adapter.reviewers,
    );
    expect(view.resolves).toEqual(adapter.resolves);
    expect(view.files.count).toBe(8);
    expect(view.files.first).toHaveLength(7);
  });

  it.each(GUARDED_WRITES)(
    '$name answers a typed unsupported error when the host cannot',
    async (write) => {
      const { port } = adapter.build({ capabilities: NO_CAPABILITIES });
      await expect(write.call(port)).rejects.toBeInstanceOf(PullRequestPortUnsupported);
    },
  );

  it('answers unsupported checks instead of an empty list', async () => {
    const view = await adapter.build({ capabilities: NO_CAPABILITIES }).port.read();
    expect(view.checks).toEqual({ read: 'unsupported', error: null, runs: [] });
  });

  describe.each(WRITES.filter((write) => !adapter.alwaysUnsupported.includes(write.name)))(
    '$name failing',
    (write) => {
      it.each(adapter.failures)(
        'classifies %s and keeps the host text',
        async (_label, text, kind) => {
          const { port } = adapter.build({ failWith: { text, kind } });
          const error = await write.call(port).then(
            () => null,
            (caught: unknown) => caught,
          );
          expect(error).toBeInstanceOf(PullRequestPortError);
          expect((error as PullRequestPortError).kind).toBe(kind);
          expect((error as PullRequestPortError).details).toBe(text);
        },
      );
    },
  );

  describe('a merge pinned to the head the user reviewed', () => {
    it('hands the reviewed head to the host', async () => {
      const built = adapter.build({ headNow: REVIEWED_HEAD });
      await built.port.merge({ method: 'squash', expectedHeadSha: REVIEWED_HEAD });
      expect(built.mergeHeadOf()).toBe(REVIEWED_HEAD);
      expect(built.mergeMethodOf()).toBe('squash');
    });

    it('refuses with stale_head when the head moved after the review', async () => {
      const built = adapter.build({ headNow: MOVED_HEAD });
      const error = await built.port
        .merge({ method: 'squash', expectedHeadSha: REVIEWED_HEAD })
        .then(
          () => null,
          (caught: unknown) => (isPullRequestPortError(caught) ? caught : null),
        );
      expect(error?.kind).toBe('stale_head');
      expect(error?.message).toBe(STALE_HEAD_MESSAGE);
    });

    it('sends no pin when the caller has none', async () => {
      const built = adapter.build({ headNow: MOVED_HEAD });
      await built.port.merge({ method: 'squash', expectedHeadSha: null });
      expect(built.mergeHeadOf()).toBeNull();
      expect(built.mergeMethodOf()).toBe('squash');
    });
  });

  it.each<PrMergeMethod>(['squash', 'merge', 'rebase'])(
    'passes the %s method through',
    async (method) => {
      const built = adapter.build({});
      await built.port.merge({ method, expectedHeadSha: null });
      expect(built.mergeMethodOf()).toBe(method);
    },
  );
});
