import type { MountId, Session, WorkflowRunId } from '@goodboy/types';
import { useCanOpenBranchWork } from '../../../hooks/useCanOpenBranchWork';
import { useSessionRuns } from '../../../hooks/useSessionRuns';
import { openBranchWorkTab } from '../../../openBranchWorkTab';
import { RunBranchChip } from '../../SessionWorkspace/parts/RunsGrid/RunBranchChip';

type Props = {
  readonly session: Session;
  readonly runId: WorkflowRunId;
};

type OpenParams = {
  readonly mountId: MountId;
};

export const RunHeadBranches = ({ session, runId }: Props) => {
  const runs = useSessionRuns({ session });
  const canOpenBranch = useCanOpenBranchWork({ sessionId: session.id });
  const run = runs.find(({ open }) => open.kind === 'run' && open.runId === runId) ?? null;
  const branches = run?.branches ?? [];
  if (branches.length === 0) {
    return null;
  }
  const open = ({ mountId }: OpenParams) => {
    openBranchWorkTab({ sessionId: session.id, mountId });
  };
  return (
    <div data-run-head-branches="" className="flex min-w-0 items-center gap-1">
      <RunBranchChip branches={branches} onOpenBranch={open} canOpenBranch={canOpenBranch} />
    </div>
  );
};
