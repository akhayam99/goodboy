import { useMemo } from 'react';
import type { PrCheckRun, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { mountPullRequestView } from '../../../../../features/review/mountPullRequestView';
import { mountReviewGithub } from '../../../../../features/review/mountReviewGithub';
import { checkRunsOf } from '../worktreeCardEntriesOf';

type Params = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
};

export const useWorktreeCheckRuns = ({
  sessionId,
  row,
}: Params): ReadonlyArray<PrCheckRun> | null => {
  const github = useAppStore((state) =>
    mountReviewGithub({ state, sessionId, mountId: row.mountId }),
  );
  const view = useAppStore((state) =>
    mountPullRequestView({
      state,
      sessionId,
      mountId: row.mountId,
      prNumber: row.request?.number ?? null,
    }),
  );
  return useMemo(() => checkRunsOf({ row, github, view }), [row, github, view]);
};
