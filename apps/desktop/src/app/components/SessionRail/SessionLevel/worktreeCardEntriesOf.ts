import type { ResolveThread } from '@goodboy/types';
import type { SessionGithubState } from '../../../../store/types';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { pullRequestKindOf } from '../../../../shared/pullRequestKind';
import type { PullRequestPresentationState } from '../../../../shared/pullRequestPresentation';
import { branchTabsOf } from '../../../../features/branch/branchTabs';
import { requestNounLabel } from '../../../../features/branch/requestNounLabel';
import {
  worktreeEntryFactsOf,
  type EntryDiffStat,
  type WorktreeEntryFacts,
} from '../../../../features/branch/worktreeEntryFacts';
import { checksRunsOf } from '../../../../features/integrations/github/checksRollup';
import { commentsCountOf } from '../../../../features/resolve/commentsCountOf';

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
};

const CARD_TABS: ReadonlySet<BranchTab> = new Set<BranchTab>(['pr', 'comments', 'files', 'checks']);

const UNREAD_CHECKS = 'Checks unknown: this token cannot read them';

export const worktreeCardEntriesOf = ({
  row,
  github,
  threads,
  diff,
}: Params): ReadonlyArray<WorktreeCardEntry> => {
  const request = row.request;
  const pullRequestState: PullRequestPresentationState =
    request === null
      ? 'none'
      : pullRequestKindOf({ state: request.state, isDraft: request.isDraft });
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
    notPushed: null,
    checks: checksRunsOf({ pr, detail: github?.detail ?? null }),
    checksUnreadReason: pr?.checksUnknown === true ? UNREAD_CHECKS : null,
  });
  return branchTabsOf({ state: pullRequestState, hasComments: false })
    .filter((entry) => CARD_TABS.has(entry.id) && (entry.id !== 'pr' || request !== null))
    .map((entry) => ({
      tab: entry.id,
      label:
        entry.id === 'pr' && request !== null
          ? requestNounLabel({ host: request.provider })
          : entry.label,
      fact: facts[entry.id],
    }));
};
