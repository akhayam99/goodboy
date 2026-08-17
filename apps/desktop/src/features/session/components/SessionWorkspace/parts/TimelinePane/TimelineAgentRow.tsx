import { useState } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { Button, Chip, Markdown, ScrollFade, StatusDot, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { formatCardTime } from '../../../../../chat/utils/format-card-time';
import { formatDuration } from '../../../../../chat/utils/format-duration';
import { agentKindPalette } from '../../../../agent-kind';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineEntries';
import { TimelineQuestionInset } from './TimelineQuestionInset';
import { TimelineRail } from './TimelineRail';

type Props = {
  readonly entry: TimelineAgentEntry;
  readonly sessionId: SessionId;
  readonly estimatedCostUsd: number | null;
};

const kindLabel = ({ entry }: Pick<Props, 'entry'>): string => {
  const palette = agentKindPalette({ kind: entry.agentKind });
  if (entry.clusterIndex != null) {
    return `${palette.label} ${entry.clusterIndex}`;
  }
  return palette.label;
};

export const TimelineAgentRow = ({ entry, sessionId, estimatedCostUsd }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const isResolver = entry.agentKind === 'resolver';
  const isRunning = entry.agent.status === 'running';
  const duration =
    entry.agent.completedAt != null
      ? formatDuration({
          durationMs: Math.max(
            0,
            new Date(entry.agent.completedAt).getTime() - new Date(entry.at).getTime(),
          ),
        })
      : null;
  const sourceLabel = isResolver
    ? 'resolve'
    : entry.workflowNumber != null
      ? `W${entry.workflowNumber}`
      : 'agent';
  const sourceTone = isResolver ? 'success' : entry.workflowNumber != null ? 'accent' : 'primary';
  const palette = agentKindPalette({ kind: entry.agentKind });
  const hasBody =
    entry.agent.outputSummary != null ||
    entry.terminalQuestions.length > 0 ||
    entry.agent.status === 'failed';

  return (
    <div
      className={cn(
        'flex flex-col rounded-md',
        isExpanded && 'bg-muted/60',
        entry.depth === 1 && 'pl-4',
      )}
    >
      <div className="group flex min-h-9 items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          aria-label={isExpanded ? 'Collapse entry' : 'Expand entry'}
          aria-expanded={isExpanded}
          disabled={!hasBody}
          onClick={() => setIsExpanded((current) => !current)}
          className="flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground disabled:opacity-30"
        >
          {isExpanded ? (
            <ChevronDown size={13} aria-hidden />
          ) : (
            <ChevronRight size={13} aria-hidden />
          )}
        </button>
        <TimelineRail joinsPrevious={entry.joinsPrevious} joinsNext={entry.joinsNext} />
        <Chip
          tone={sourceTone}
          label={sourceLabel}
          title={entry.workflowName ?? undefined}
          shape="badge"
          size="xs"
          width="sm"
          uppercase
        />
        {isResolver ? (
          <span className="inline-block min-w-16" />
        ) : (
          <Chip
            tone="neutral"
            label={kindLabel({ entry })}
            shape="badge"
            size="xs"
            width="sm"
            uppercase
            className={palette.fg}
          />
        )}
        <span className={cn('min-w-0 flex-1 truncate text-sm', isRunning && 'font-medium')}>
          {entry.agent.name}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-2xs text-muted-foreground tabular-nums">
          {duration != null ? <span>{duration}</span> : null}
          {estimatedCostUsd != null ? <span>${estimatedCostUsd.toFixed(2)}</span> : null}
          {isRunning ? (
            <StatusDot tone="info" size="sm" pulsing ariaLabel="Running" />
          ) : entry.agent.status === 'completed' ? (
            <Check size={13} aria-label="Completed" className="text-success" />
          ) : (
            <span className={entry.agent.status === 'failed' ? 'text-danger' : ''}>
              {entry.agent.status}
            </span>
          )}
          <span>{formatCardTime(entry.at)}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void selectAgent(sessionId, entry.agent.id)}
          >
            {isResolver ? 'Open resolve' : 'Open chat'}
          </Button>
        </span>
      </div>
      {isExpanded ? (
        <div className="flex flex-col gap-4 px-10 pb-3 pt-1">
          {entry.agent.outputSummary != null ? (
            <section className="flex flex-col gap-2">
              <span className="text-2xs uppercase text-muted-foreground">Outcome</span>
              <ScrollFade className="max-h-48">
                <Markdown text={entry.agent.outputSummary} />
              </ScrollFade>
            </section>
          ) : null}
          {entry.terminalQuestions.length > 0 ? (
            <section className="flex flex-col gap-2">
              <span className="text-2xs uppercase text-muted-foreground">Questions</span>
              {entry.terminalQuestions.map((question) => (
                <div key={question.id} className="flex flex-col gap-1 text-xs">
                  <span>{question.text}</span>
                  <span className="text-muted-foreground">
                    {question.userAnswer ?? question.status}
                  </span>
                </div>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
      {entry.openQuestions.map((question) => (
        <TimelineQuestionInset key={question.id} question={question} sessionId={sessionId} />
      ))}
    </div>
  );
};
