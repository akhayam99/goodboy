import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button, Chip, Markdown, ScrollFade, cn } from '@goodboy/ui';
import type { DiffComment, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { formatDuration } from '../../../../../chat/utils/format-duration';
import { agentKindPalette } from '../../../../agent-kind';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineGroups';
import { TimelineNode } from './TimelineNode';

type Props = {
  readonly entry: TimelineAgentEntry;
  readonly sessionId: SessionId;
  readonly estimatedCostUsd: number | null;
  readonly timeLabel: string | null;
  readonly diffComment?: DiffComment | null;
};

type KindLabelParams = {
  readonly entry: TimelineAgentEntry;
};

const kindLabel = ({ entry }: KindLabelParams): string => {
  const palette = agentKindPalette({ kind: entry.agentKind });
  if (entry.clusterIndex != null) {
    return `${palette.label} ${entry.clusterIndex}`;
  }
  return palette.label;
};

export const TimelineAgentRow = ({
  entry,
  sessionId,
  estimatedCostUsd,
  timeLabel,
  diffComment = null,
}: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const isResolver = entry.agentKind === 'resolver';
  const isRunning = entry.agent.status === 'running';
  const duration =
    entry.hasDuration && entry.agent.completedAt != null
      ? formatDuration({
          durationMs: Math.max(
            0,
            new Date(entry.agent.completedAt).getTime() - new Date(entry.at).getTime(),
          ),
        })
      : null;
  const palette = agentKindPalette({ kind: entry.agentKind });
  const hasBody =
    entry.agent.outputSummary != null ||
    entry.terminalQuestions.length > 0 ||
    entry.agent.status === 'failed' ||
    diffComment != null;
  const meta = [
    duration,
    estimatedCostUsd != null ? `$${estimatedCostUsd.toFixed(2)}` : null,
    entry.agent.status === 'failed' ? 'failed' : null,
  ].filter((value): value is string => value != null);

  return (
    <div
      className={cn(
        'relative grid grid-cols-[44px_24px_minmax(0,1fr)]',
        isExpanded && 'rounded-md bg-muted/60',
      )}
    >
      <span className="self-start py-2 text-right text-3xs tabular-nums text-muted-foreground">
        {timeLabel}
      </span>
      <div className="relative flex min-h-9 items-center justify-center">
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
        <span className="relative z-10 flex size-4 items-center justify-center bg-canvas">
          <TimelineNode status={entry.agent.status} size={entry.depth === 0 ? 'main' : 'child'} />
        </span>
      </div>
      <div
        className={cn(
          'group flex min-w-0 flex-col',
          entry.depth === 1 && 'pl-5',
          entry.depth === 2 && 'pl-10',
        )}
      >
        <div className="flex min-h-9 min-w-0 items-center gap-2 py-1.5">
          {!isResolver ? (
            <Chip
              tone="neutral"
              label={kindLabel({ entry })}
              shape="badge"
              size="xs"
              width="sm"
              uppercase
              className={palette.fg}
            />
          ) : null}
          <button
            type="button"
            disabled={!hasBody}
            aria-expanded={hasBody ? isExpanded : undefined}
            aria-label={
              hasBody ? `${isExpanded ? 'Collapse' : 'Expand'} ${entry.agent.name}` : undefined
            }
            onClick={() => setIsExpanded((current) => !current)}
            className={cn(
              'min-w-0 truncate text-left text-sm text-foreground',
              isRunning && 'font-medium',
            )}
          >
            {entry.agent.name}
          </button>
          {meta.length > 0 ? (
            <span
              className={cn(
                'shrink-0 text-2xs tabular-nums text-muted-foreground',
                entry.agent.status === 'failed' && 'text-danger',
              )}
            >
              {meta.join(' · ')}
            </span>
          ) : null}
          <span className="flex flex-1 justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void selectAgent(sessionId, entry.agent.id)}
            >
              {isResolver ? 'Open resolve' : 'Open chat'}
            </Button>
            {hasBody ? (
              isExpanded ? (
                <ChevronDown size={13} aria-hidden />
              ) : (
                <ChevronRight size={13} aria-hidden />
              )
            ) : null}
          </span>
        </div>
        {isExpanded ? (
          <div className="flex flex-col gap-4 pb-3 pr-3">
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
            {diffComment != null ? (
              <section className="flex flex-col gap-2">
                <span className="text-2xs uppercase text-muted-foreground">Origin</span>
                <span className="text-xs text-foreground">{diffComment.body}</span>
                <span className="text-2xs text-muted-foreground">
                  {diffComment.resolvedAt != null
                    ? 'resolved'
                    : diffComment.consumedAt != null
                      ? 'consumed'
                      : 'open'}
                </span>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
