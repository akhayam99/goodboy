import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Chip, Markdown, ScrollFade, cn } from '@goodboy/ui';
import type { DiffComment, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { formatDuration } from '../../../../../chat/utils/format-duration';
import { agentKindPalette } from '../../../../agent-kind';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineGroups';
import { TimelineAnswerRow } from './TimelineAnswerRow';
import { TimelineNode } from './TimelineNode';
import { TimelineRow } from './TimelineRow';

type Props = {
  readonly entry: TimelineAgentEntry;
  readonly sessionId: SessionId;
  readonly timeLabel: string | null;
  readonly diffComment?: DiffComment | null;
  readonly onSeen?: () => void;
  readonly hasRoleColumn?: boolean;
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

const DWELL_MS = 900;

export const TimelineAgentRow = ({
  entry,
  sessionId,
  timeLabel,
  diffComment = null,
  onSeen,
  hasRoleColumn = true,
}: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dwellTimer, setDwellTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const isResolver = entry.agentKind === 'resolver';
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
  const meta = duration != null ? duration : null;
  const roleChip = !isResolver ? (
    <Chip
      tone="neutral"
      label={kindLabel({ entry })}
      shape="badge"
      size="xs"
      width="md"
      uppercase
      className={palette.fg}
    />
  ) : null;
  const trailing = hasBody ? (
    <button
      type="button"
      aria-expanded={isExpanded}
      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${entry.agent.name}`}
      onClick={(event) => {
        event.stopPropagation();
        setIsExpanded((current) => !current);
      }}
      className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]"
    >
      {isExpanded ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
    </button>
  ) : null;
  const navigate = () => void selectAgent(sessionId, entry.agent.id);
  const cancelDwell = () => {
    if (dwellTimer != null) {
      clearTimeout(dwellTimer);
      setDwellTimer(null);
    }
  };
  const startDwell = () => {
    if (onSeen == null) {
      return;
    }
    cancelDwell();
    const timer = setTimeout(() => {
      onSeen();
      setDwellTimer(null);
    }, DWELL_MS);
    setDwellTimer(timer);
  };

  return (
    <div className="flex flex-col">
      <TimelineRow
        timeLabel={timeLabel}
        depth={entry.depth}
        hasRoleColumn={hasRoleColumn}
        isHighlighted={isExpanded}
        marker={<TimelineNode status={entry.agent.status} />}
        roleChip={roleChip}
        onClick={navigate}
        onMouseEnter={startDwell}
        onMouseLeave={cancelDwell}
        ariaLabel={
          isResolver ? `open resolve for ${entry.agent.name}` : `open chat for ${entry.agent.name}`
        }
        label={
          <span
            className={cn(
              'min-w-0 truncate text-sm text-foreground',
              entry.agent.status === 'running' && 'font-medium',
            )}
          >
            {entry.agent.name}
          </span>
        }
        meta={
          meta != null || entry.agent.status === 'failed' ? (
            <span
              className={cn(
                'text-2xs tabular-nums text-muted-foreground',
                entry.agent.status === 'failed' && 'text-danger',
              )}
            >
              {[meta, entry.agent.status === 'failed' ? 'failed' : null]
                .filter((value): value is string => value != null)
                .join(' · ')}
            </span>
          ) : null
        }
        trailing={trailing}
      />
      {isExpanded ? (
        <div
          className={cn(
            'flex flex-col gap-4 pb-3 pr-3',
            entry.depth === 0 && 'pl-[92px]',
            entry.depth === 1 && 'pl-[116px]',
            entry.depth === 2 && 'pl-[140px]',
          )}
        >
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
      {entry.answers.map((answer) => (
        <TimelineAnswerRow
          key={answer.id}
          entry={answer}
          timeLabel={null}
          hasRoleColumn={hasRoleColumn}
          onOpen={navigate}
        />
      ))}
    </div>
  );
};
