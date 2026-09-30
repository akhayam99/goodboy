import type { HistoryApplied, HistoryRun } from '../../../../store/slices/history/types';
import { HistoryResult } from './HistoryResult';
import type { useHistoryRunFlow } from './useHistoryRunFlow';

type Props = {
  readonly applied: HistoryApplied;
  readonly run: HistoryRun;
  readonly flow: NonNullable<ReturnType<typeof useHistoryRunFlow>>;
  readonly branch: string;
  readonly nowMs: number;
  readonly hasUpstream: boolean;
  readonly prNumber: number | null;
};

export const HistoryAppliedResult = ({
  applied,
  run,
  flow,
  branch,
  nowMs,
  hasUpstream,
  prNumber,
}: Props) => (
  <HistoryResult
    applied={applied}
    phase={run.phase}
    stop={run.stop}
    backupRef={run.backupRef}
    branch={branch}
    nowMs={nowMs}
    hasUpstream={hasUpstream}
    prNumber={prNumber}
    onPush={() => flow.push(run)}
    onBringOrigin={flow.bringOrigin}
    onRestore={() => flow.restoreApplied(run)}
    onDone={flow.dismiss}
  />
);
