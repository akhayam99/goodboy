import type { SessionId } from '@goodboy/types';
import { Button, Tooltip } from '@goodboy/ui';
import { useToast } from '../../../../shared/components/Toast';
import { useAppStore } from '../../../../store';
import { useAgentOutcome } from '../../../../shared/hooks/useAgentOutcome';
import { ObjectActionVerb } from '../../../actions/ObjectActionVerb';
import type { FixRunActionTarget } from '../../../actions/types';
import { ITEM_WORK_WORDS } from '../../../live-state/itemWork/itemWorkWords';
import { ItemWorkLine } from '../../../live-state/itemWork/ItemWorkLine';
import { FIX_STOPPED_MESSAGE } from '../../fixStoppedMessage';
import { stopFixWithResume } from '../../stopFixWithResume';
import { checksSkippedLine, checksSkippedOf } from '../../checksSkipped';
import { fixRunCountOf, type FixRun } from '../../fixRun';
import type { LaneStatus } from '../../laneStatus';
import { fixingPlaceText, threadCountText } from '../../reviewLaunchCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly run: FixRun;
  readonly lane: LaneStatus | null;
};

export const FixRunCount = ({ sessionId, run, lane }: Props) => {
  const openDrawer = useAppStore((s) => s.openDrawer);
  const { showToast } = useToast();
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
        onStop: () =>
          stopFixWithResume({
            getState: useAppStore.getState,
            showToast,
            sessionId,
            agentId: run.agentId,
            lane,
            message: FIX_STOPPED_MESSAGE,
          }),
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
