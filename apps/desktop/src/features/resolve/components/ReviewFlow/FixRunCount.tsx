import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useAgentOutcome } from '../../../../shared/hooks/useAgentOutcome';
import type { FixRunActionTarget } from '../../../actions/types';
import { ItemWorkLine } from '../../../live-state/itemWork/ItemWorkLine';
import { ThreadOverflowMenu } from './ThreadOverflowMenu';
import { checksSkippedLine, checksSkippedOf } from '../../checksSkipped';
import { fixRunCountOf, type FixRun } from '../../fixRun';
import type { LaneStatus } from '../../laneStatus';
import { fixingPlaceText, threadCountText } from '../../reviewLaunchCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly run: FixRun;
  readonly lane: LaneStatus | null;
};

const FIX_RUN_COUNT_COPY = {
  stopDescription: 'Comments it has not finished stay open and can be fixed again.',
  menu: 'Fix actions',
} as const;

export const FixRunCount = ({ sessionId, run, lane }: Props) => {
  const openDrawer = useAppStore((s) => s.openDrawer);
  const forceCloseResolver = useAppStore((s) => s.forceCloseResolver);
  const stopResolveLane = useAppStore((s) => s.stopResolveLane);
  const outputSummary = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId]?.find((agent) => agent.id === run.agentId)?.outputSummary,
  );
  const outcome = useAgentOutcome({
    agent: { id: run.agentId, ...(outputSummary !== undefined && { outputSummary }) },
  });
  const skipped = checksSkippedOf({ text: outcome.text });
  const count = fixRunCountOf({ run });
  if (count === null) {
    return null;
  }
  const target: FixRunActionTarget = {
    kind: 'fixRun',
    facts: {
      stop: {
        title: `Stop the fix for ${threadCountText({ count: run.total })}?`,
        description: FIX_RUN_COUNT_COPY.stopDescription,
        onStop: () =>
          lane === null
            ? forceCloseResolver(sessionId, run.agentId)
            : stopResolveLane({ sessionId, worktreePath: lane.worktreePath }),
      },
      transcriptNote: skipped === null ? null : checksSkippedLine({ skipped }),
      onOpenTranscript: () =>
        openDrawer({ kind: 'transcript', sessionId, payload: { agentId: run.agentId } }),
      onRetryWithHint: null,
      startOverNote: null,
      onStartOver: null,
    },
  };
  return (
    <span data-fix-run-count="" className="flex min-w-0 justify-end">
      <ItemWorkLine
        state="fixing"
        detail={fixingPlaceText(count)}
        agentId={run.agentId}
        action={<ThreadOverflowMenu label={FIX_RUN_COUNT_COPY.menu} target={target} />}
      />
    </span>
  );
};
