import type {
  BranchCommit,
  PrCheckRun,
  PullRequestState,
  PullRequestView,
  ResolveThread,
  WorktreeStatus,
} from '@goodboy/types';
import type { SessionGithubState } from '../../../../store/types';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { branchTabsOf, type BranchScope } from '../../../../features/branch/branchTabs';
import { requestNounLabel } from '../../../../features/branch/requestNounLabel';
import {
  worktreeEntryFactsOf,
  type EntryDiffStat,
  type WorktreeEntryFacts,
} from '../../../../features/branch/worktreeEntryFacts';
import { checksRunsOf } from '../../../../features/integrations/github/checksRollup';
import { notPushedOf } from '../../../../features/branch/notPushedOf';
import { commentsCountOf } from '../../../../features/resolve/commentsCountOf';
import { requestStateOf } from './requestStateOf';

export type WorktreeCardEntry = {
  readonly tab: BranchTab;
  readonly label: string;
  readonly fact: WorktreeEntryFacts[BranchTab];
};

type Params = {
  readonly row: MountRowView;
  readonly github: SessionGithubState | null;
  readonly threads: ReadonlyArray<ResolveThread>;
  readonly diff: EntryDiffStat | null;
  readonly view: PullRequestView | null;
  readonly scope: BranchScope | null;
  readonly status: WorktreeStatus | null;
  readonly commits: ReadonlyArray<BranchCommit> | null;
  readonly hasRemoteHead: boolean;
};

const UNREAD_CHECKS = 'Checks unknown: this token cannot read them';

type RunsParams = Pick<Params, 'github' | 'view'> & {
  readonly pr: PullRequestState | null;
};

const runsOf = ({ github, view, pr }: RunsParams): ReadonlyArray<PrCheckRun> | null => {
  const fromDetail = checksRunsOf({ pr, detail: github?.detail ?? null });
  if (fromDetail !== null) {
    return fromDetail;
  }
  return view !== null && view.checks.read === 'ok' ? view.checks.runs : null;
};

type UnreadParams = Pick<Params, 'view'> & {
  readonly pr: PullRequestState | null;
};

const unreadReasonOf = ({ view, pr }: UnreadParams): string | null =>
  pr?.checksUnknown === true ||
  (view !== null && view.checks.read !== 'ok' && view.checks.read !== 'unsupported')
    ? UNREAD_CHECKS
    : null;

type CheckRunsParams = Pick<Params, 'row' | 'github' | 'view'>;

export const checkRunsOf = ({
  row,
  github,
  view,
}: CheckRunsParams): ReadonlyArray<PrCheckRun> | null => {
  const request = row.request;
  const pr = request !== null && github?.pr?.number === request.number ? github.pr : null;
  return runsOf({ github, view, pr });
};

export const worktreeCardEntriesOf = ({
  row,
  github,
  threads,
  diff,
  view,
  scope,
  status,
  commits,
  hasRemoteHead,
}: Params): ReadonlyArray<WorktreeCardEntry> => {
  const request = row.request;
  const pullRequestState = requestStateOf({ request });
  const pr = request !== null && github?.pr?.number === request.number ? github.pr : null;
  const ownThreads =
    request === null
      ? []
      : threads.filter(
          (thread) =>
            thread.prNumber === request.number &&
            (thread.projectId === null || thread.projectId === row.projectId),
        );
  const facts = worktreeEntryFactsOf({
    pullRequestState,
    commentsNeedYou: commentsCountOf({ threads: ownThreads }).needsYou,
    files: null,
    diff,
    notPushed: notPushedOf({ status, commits, hasRemoteHead }),
    checks: runsOf({ github, view, pr }),
    checksUnreadReason: unreadReasonOf({ view, pr }),
  });
  return branchTabsOf(scope ?? { state: pullRequestState, hasComments: false }).map((entry) => ({
    tab: entry.id,
    label:
      entry.id === 'pr' && request !== null
        ? requestNounLabel({ host: request.provider })
        : entry.label,
    fact: facts[entry.id],
  }));
};
