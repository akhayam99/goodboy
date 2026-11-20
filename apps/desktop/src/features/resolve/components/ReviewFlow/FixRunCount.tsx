import type { SessionId } from '@goodboy/types';
import { Button, Tooltip } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useAgentOutcome } from '../../../../shared/hooks/useAgentOutcome';
import { ObjectActionVerb } from '../../../actions/ObjectActionVerb';
import type { FixRunActionTarget } from '../../../actions/types';
import { ITEM_WORK_WORDS } from '../../../live-state/itemWork/itemWorkWords';
import { ItemWorkLine } from '../../../live-state/itemWork/ItemWorkLine';
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
  const comments = threadCountText({ count: run.total });
  const openTranscript = () =>
    openDrawer({ kind: 'transcript', sessionId, payload: { agentId: run.agentId } });
  const target: FixRunActionTarget = {
    kind: 'fixRun',
    facts: {
      stop: {
        label: `Stop fixing ${comments}`,
        title: `Stop the fix for ${comments}?`,
        description: FIX_RUN_COUNT_COPY.stopDescription,
        onStop: () =>
          lane === null
            ? forceCloseResolver(sessionId, run.agentId)
            : stopResolveLane({ sessionId, worktreePath: lane.worktreePath }),
      },
      transcriptNote: null,
      onOpenTranscript: null,
      onRetryWithHint: null,
      startOverNote: null,
      onStartOver: null,
    },
  };
  return (
    <span data-fix-run-count="" className="flex min-w-0 items-center justify-end gap-2">
      <Tooltip
        content={skipped === null ? null : checksSkippedLine({ skipped })}
        isSuppressed={skipped === null}
        anchorClassName="min-w-0"
      >
        <Button
          variant="quiet"
          size="sm"
          aria-label={`${ITEM_WORK_WORDS.verb.openTranscript}, ${fixingPlaceText(count)}`}
          onClick={openTranscript}
          className="min-w-0 justify-start font-normal"
        >
          <ItemWorkLine state="fixing" detail={fixingPlaceText(count)} agentId={run.agentId} />
        </Button>
      </Tooltip>
      <ObjectActionVerb target={target} actionId="fixRun.stopAll" />
    </span>
  );
};
