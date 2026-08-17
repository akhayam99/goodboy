import { useState } from 'react';
import { ArrowRight, Milestone } from 'lucide-react';
import { Button, Markdown, tintClasses } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import type { TranscriptItem } from '../../utils/transcript-items';
import { formatCardTime } from '../../utils/format-card-time';
import { formatDuration } from '../../utils/format-duration';
import { stripWorkflowHandoffHeading } from './stripWorkflowHandoffHeading';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TranscriptRowHeader } from '../TranscriptRowHeader';

const warningTint = tintClasses('warning');

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'step_transition' }>;
};

export const PhaseTransitionCard = ({ item }: Props) => {
  const [open, setOpen] = useState(item.degraded === true);
  const [isRetrying, setIsRetrying] = useState(false);
  const retryStepSummary = useAppStore((state) => state.retryStepSummary);
  const timestamp = formatCardTime(item.at);
  const context = stripWorkflowHandoffHeading({ context: item.carryForwardContext });
  const hasContext = context.trim().length > 0;
  const canRetry = item.sessionId != null && item.fromAgentId != null;
  const retry = async () => {
    const sessionId = item.sessionId;
    const agentId = item.fromAgentId;
    if (sessionId == null || agentId == null || isRetrying) {
      return;
    }
    setIsRetrying(true);
    try {
      await retryStepSummary({ sessionId, agentId });
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <TranscriptDisclosure
      tone="primary"
      open={open && hasContext}
      bodyClassName="gap-2"
      header={
        <TranscriptRowHeader
          grouped
          tone="primary"
          icon={<Milestone size={12} aria-hidden />}
          eyebrow="step"
          open={open}
          onToggle={() => setOpen((value) => !value)}
          badge={
            item.degraded === true && (
              <span
                className={`shrink-0 rounded-md px-1 py-px text-2xs font-medium ${warningTint.bg} ${warningTint.text}`}
              >
                degraded handoff
              </span>
            )
          }
          preview={
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate">
                {item.fromStep.ordinal + 1}. {item.fromStep.name}
              </span>
              <ArrowRight size={12} aria-hidden className="shrink-0 opacity-60" />
              <span className="truncate">
                {item.toStep.ordinal + 1}. {item.toStep.name}
              </span>
            </span>
          }
          meta={
            <span className="flex items-center gap-1.5">
              {item.durationMs != null && (
                <span>{formatDuration({ durationMs: item.durationMs })}</span>
              )}
              <span>{timestamp}</span>
            </span>
          }
        />
      }
    >
      {item.degraded === true ? (
        <div className={`flex flex-col gap-2 rounded-md p-3 text-xs ${warningTint.bg}`}>
          <span className={warningTint.text}>
            The summary failed, so this step received a deterministic copy of the previous output.
            Long output omits its middle. A retry repairs the summary for later steps, but cannot
            replace context already sent to this step.
          </span>
          <Button
            variant="warning"
            emphasis="outline"
            size="sm"
            disabled={!canRetry || isRetrying}
            onClick={() => void retry()}
            className="self-start"
          >
            {isRetrying ? 'Retrying summary' : 'Retry summary'}
          </Button>
        </div>
      ) : null}
      <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        carried forward
      </span>
      <div className="overflow-x-auto text-xs text-foreground/80">
        <Markdown text={context} />
      </div>
    </TranscriptDisclosure>
  );
};
