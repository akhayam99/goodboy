import { describe, expect, it } from 'vitest';
import type { PrMergeMethod, PullRequestView } from '@goodboy/types';
import { githubPullRequestPort } from '../githubPullRequestPort';
import {
  PullRequestPortError,
  PullRequestPortUnsupported,
  type PullRequestPort,
} from '../pullRequestPort';
import { REVIEW_SOURCE_CAPABILITIES, type ReviewSourceCapabilities } from '../types';
import { GITHUB_PR_REPO, GITHUB_PR_URL, failure, githubRunner } from './githubPullRequestFixture';

type Built = Readonly<{
  port: PullRequestPort;
  mergeMethodOf: () => PrMergeMethod | null;
}>;

type BuildParams = Readonly<{
  failWith?: string;
  capabilities?: ReviewSourceCapabilities;
}>;

type Adapter = Readonly<{
  name: string;
  noun: string;
  build: (params: BuildParams) => Built;
}>;

const NO_CAPABILITIES: ReviewSourceCapabilities = {
  ...REVIEW_SOURCE_CAPABILITIES.local,
  canReply: false,
  canResolve: false,
};

const FLAG_METHOD: Readonly<Record<string, PrMergeMethod>> = {
  '--squash': 'squash',
  '--merge': 'merge',
  '--rebase': 'rebase',
};

const github: Adapter = {
  name: 'github',
  noun: 'pull request',
  build: ({ failWith, capabilities }) => {
    const { runner, calls } = githubRunner({
      override: (args) =>
        failWith !== undefined && args[0] === 'pr' && args[1] !== 'view'
          ? failure({ stderr: failWith })
          : null,
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
    };
  },
};

const ADAPTERS: ReadonlyArray<Adapter> = [github];

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
  { name: 'merge', call: (port) => port.merge({ method: 'squash' }) },
];

const FAILURES: ReadonlyArray<readonly [string, string, string]> = [
  ['denied', 'GraphQL: Resource not accessible by personal access token', 'denied'],
  ['rate limited', 'API rate limit exceeded for user', 'rate_limited'],
  ['offline', 'dial tcp: lookup api.github.com: no such host', 'network'],
  ['rejected', 'Pull request is in clean status', 'failed'],
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
    expect(view.reviewers.map((reviewer) => [reviewer.person.login, reviewer.state])).toEqual([
      ['omar-t', 'changes_requested'],
      ['kenji-w', 'approved'],
      ['priya-n', 'pending'],
    ]);
    expect(view.resolves).toEqual([
      { label: '#412', url: expect.stringContaining('/issues/412'), isClosing: true },
    ]);
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

  describe.each(WRITES)('$name failing', (write) => {
    it.each(FAILURES)('classifies %s and keeps the host text', async (_label, stderr, kind) => {
      const { port } = adapter.build({ failWith: stderr });
      const error = await write.call(port).then(
        () => null,
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(PullRequestPortError);
      expect((error as PullRequestPortError).kind).toBe(kind);
      expect((error as PullRequestPortError).details).toBe(stderr);
    });
  });

  it.each<PrMergeMethod>(['squash', 'merge', 'rebase'])(
    'passes the %s method through',
    async (method) => {
      const built = adapter.build({});
      await built.port.merge({ method });
      expect(built.mergeMethodOf()).toBe(method);
    },
  );
});
