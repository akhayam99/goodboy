import type { MountId, Session, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { branchPlace } from '../../../../store/slices/navigation/place';
import { useSessionRuns } from '../../hooks/useSessionRuns';
import { RunBranchChip } from '../SessionWorkspace/parts/RunsGrid/RunBranchChip';

type Props = {
  readonly session: Session;
  readonly runId: WorkflowRunId;
};

type OpenParams = {
  readonly mountId: MountId;
};

export const RunHeadBranches = ({ session, runId }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const runs = useSessionRuns({ session });
  const run = runs.find(({ open }) => open.kind === 'run' && open.runId === runId) ?? null;
  const branches = run?.branches ?? [];
  if (branches.length === 0) {
    return null;
  }
  const open = ({ mountId }: OpenParams) => {
    const branch = branches.find((candidate) => candidate.mountId === mountId);
    navigate({
      to: branchPlace({ sessionId: session.id, mountPath: branch?.worktreePath ?? null }),
    });
  };
  return (
    <div data-run-head-branches="" className="flex min-w-0 items-center gap-1">
      <RunBranchChip branches={branches} onOpenBranch={open} />
    </div>
  );
};
