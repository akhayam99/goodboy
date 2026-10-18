import { describe, expect, it } from 'vitest';
import type {
  MountId,
  MountPullRequestProvider,
  PrCheckRun,
  ProjectId,
  PullRequestChecksRead,
  PullRequestView,
} from '@goodboy/types';
import type {
  MountRequestView,
  MountRowView,
} from '../../../../store/slices/project-mounts/mountRowModel';
import { brandedId } from '../../../../features/history/testing/brandedId';
import { worktreeCardEntriesOf } from './worktreeCardEntriesOf';

const run = (conclusion: PrCheckRun['conclusion']): PrCheckRun => ({
  name: 'unit tests',
  conclusion,
  detailsUrl: null,
  durationMs: null,
});

const requestOf = ({
  provider,
}: {
  readonly provider: MountPullRequestProvider;
}): MountRequestView => ({
  provider,
  identity: null,
  number: 57,
  state: 'open',
  isDraft: false,
  checks: null,
  reviewDecision: null,
  url: 'https://example.invalid/57',
  title: 'Surface retry state in notify-relay',
  label: 'MR !57',
});

const rowOf = ({ provider }: { readonly provider: MountPullRequestProvider }): MountRowView => ({
  mountId: brandedId<MountId>({ value: 'mount-notify' }),
  projectId: brandedId<ProjectId>({ value: 'project-notify' }),
  projectName: 'notify-relay',
  projectKind: 'repo',
  mountName: 'notify-relay',
  branch: 'hl/surface-retry-state',
  baseBranch: 'main',
  worktreePath: '/work/notify-relay',
  lastWorktreePath: null,
  repoRoot: '/work/notify-relay',
  isAttached: true,
  isMainCheckout: false,
  isOnDisk: true,
  revision: 1,
  parallelIndex: 0,
  request: requestOf({ provider }),
  series: null,
  observation: null,
  observedBranchHolder: null,
  isFinished: false,
});

const viewOf = ({
  read,
  runs,
}: {
  readonly read: PullRequestChecksRead;
  readonly runs: ReadonlyArray<PrCheckRun>;
}): PullRequestView => ({
  host: 'gitlab',
  number: 57,
  title: 'Surface retry state in notify-relay',
  body: '',
  url: 'https://example.invalid/57',
  state: 'open',
  isDraft: false,
  author: null,
  baseBranch: 'main',
  headBranch: 'hl/surface-retry-state',
  headSha: null,
  createdAt: '2026-10-05T09:00:00.000Z',
  updatedAt: '2026-10-05T09:00:00.000Z',
  mergedAt: null,
  mergeable: null,
  reviewDecision: null,
  reviewers: [],
  resolves: [],
  checks: { read, error: null, runs },
  files: { count: 0, first: [] },
  commits: [],
  mergeMethods: [],
  mergeMethodReasons: {},
});

const checksEntryOf = ({
  provider,
  view,
}: {
  readonly provider: MountPullRequestProvider;
  readonly view: PullRequestView | null;
}) =>
  worktreeCardEntriesOf({
    row: rowOf({ provider }),
    github: null,
    threads: [],
    diff: null,
    view,
  }).find((entry) => entry.tab === 'checks');

describe('the check counts of a branch row on every host', () => {
  for (const provider of ['gitlab', 'bitbucket'] as const) {
    it(`counts the runs read for a ${provider} request, not only GitHub's`, () => {
      const entry = checksEntryOf({
        provider,
        view: viewOf({ read: 'ok', runs: [run('success'), run('failure'), run('failure')] }),
      });
      expect(entry?.fact).toMatchObject({ text: '2', tone: 'danger', tooltip: '2 failing' });
    });

    it(`keeps skipped runs apart from passed on ${provider}`, () => {
      const entry = checksEntryOf({
        provider,
        view: viewOf({ read: 'ok', runs: [run('skipped'), run('neutral')] }),
      });
      expect(entry?.fact.tooltip).toBe('2 skipped');
    });

    it(`says why there is no count when the ${provider} token cannot read the checks`, () => {
      const entry = checksEntryOf({ provider, view: viewOf({ read: 'denied', runs: [] }) });
      expect(entry?.fact.text).toBeNull();
      expect(entry?.fact.tooltip).toBe('Checks unknown: this token cannot read them');
    });

    it(`draws nothing while the ${provider} view is not loaded`, () => {
      const entry = checksEntryOf({ provider, view: null });
      expect(entry?.fact.text).toBeNull();
      expect(entry?.fact.tooltip).toBeNull();
    });
  }
});
