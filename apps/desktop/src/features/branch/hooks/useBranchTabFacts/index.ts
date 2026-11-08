import type { PrDetail, PullRequestView, Session } from '@goodboy/types';
import { useMountDiffStats } from '../../../../store';
import type { PullRequestPresentationState } from '../../../../shared/utils/pullRequestPresentation';
import type { ThreadEntry } from '../../../resolve/commentGroupsView';
import { branchWorkTabRegistration } from '../../../session/branchWorkTabRegistration';
import { branchTabFactsOf } from '../../branchTabFactsOf';
import { checksUnreadReasonOf } from '../../checksUnreadReasonOf';
import { pullRequestRunsOf } from '../../pullRequestRunsOf';
import { pullRequestThreadCountsOf } from '../../pullRequestThreadCountsOf';
import type { BranchIdentity } from '../useBranchIdentity';

type Params = {
  readonly session: Session;
  readonly identity: BranchIdentity;
  readonly state: PullRequestPresentationState;
  readonly detail: PrDetail | null;
  readonly view: PullRequestView | null;
  readonly entries: ReadonlyArray<ThreadEntry>;
  readonly loadedFiles: number | null;
  readonly ahead: number | null;
  readonly notPushed: number | null;
};

export const useBranchTabFacts = ({
  session,
  identity,
  state,
  detail,
  view,
  entries,
  loadedFiles,
  ahead,
  notPushed,
}: Params) => {
  const mountDiffStats = useMountDiffStats(session.id);
  const work = branchWorkTabRegistration.useWork({
    session,
    mountId: identity.mount?.mountId ?? null,
    mountPath: identity.mountPath,
  });
  const { pr } = identity;
  const mountStat = mountDiffStats.get(identity.mountPath ?? '') ?? null;
  const counts = pullRequestThreadCountsOf({ pr, detail, entries, isWithNotes: true });
  const facts = branchTabFactsOf({
    pullRequestState: state,
    commentsNeedYou: counts.needYou,
    commentsOpen: counts.open,
    files: mountStat?.files ?? loadedFiles,
    diff: mountStat,
    commits: ahead,
    notPushed,
    checks: pullRequestRunsOf({ pr, detail, view }),
    checksUnreadReason: checksUnreadReasonOf({ pr, detail }),
    work: work.counts,
  });
  return { facts, work };
};
