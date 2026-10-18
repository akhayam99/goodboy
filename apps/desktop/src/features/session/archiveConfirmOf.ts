import type { ActionConfirm } from '../actions/types';

type Params = {
  readonly runningAgentCount: number;
};

const KEPT = 'Branches, worktrees and history stay on disk, and Restore brings it back.';

export const archiveConfirmOf = ({ runningAgentCount }: Params): ActionConfirm => ({
  title: 'Archive session?',
  description:
    runningAgentCount === 0
      ? KEPT
      : `${runningAgentCount} ${runningAgentCount === 1 ? 'agent is' : 'agents are'} still running in this session. ${KEPT}`,
  confirmLabel: 'Archive session',
  role: 'alert',
});
