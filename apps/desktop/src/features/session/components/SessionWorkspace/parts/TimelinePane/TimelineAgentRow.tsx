import { useEffect, useRef } from 'react';
import { Chip, Markdown, ScrollFade, cn } from '@goodboy/ui';
import type { DiffComment, SessionId } from '@goodboy/types';
import { agentHasUnread, useAppStore } from '../../../../../../store';
import { formatDuration } from '../../../../../chat/utils/format-duration';
import { agentKindPalette } from '../../../../agent-kind';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineGroups';
import type { TimelineDepth } from '../../../../timeline/flattenTimelineRows';
import type { RunIdentity } from '../../../../timeline/runIdentity';
import { TimelineQuestionInset } from './TimelineQuestionInset';
import { TimelineRow } from './TimelineRow';
import { TimelineStatusMarker, type TimelineMarkerState } from './TimelineStatusMarker';

type Props = {
  readonly entry: TimelineAgentEntry;
  readonly sessionId: SessionId;
  readonly timeLabel: string | null;
  readonly depth: TimelineDepth;
  readonly identity: RunIdentity | null;
  readonly diffComment: DiffComment | null;
  readonly isExpanded: boolean;
  readonly onToggle: () => void;
  readonly onSeen: () => void;
};

const DWELL_MS = 900;

type DurationParams = {
  readonly entry: TimelineAgentEntry;
};

const durationOf = ({ entry }: DurationParams): string | null => {
  if (!entry.hasDuration || entry.agent.startedAt == null || entry.agent.completedAt == null) {
    return null;
  }
  return formatDuration({
    durationMs: Math.max(
      0,
      new Date(entry.agent.completedAt).getTime() - new Date(entry.agent.startedAt).getTime(),
    ),
  });
};

type StateParams = {
  readonly entry: TimelineAgentEntry;
  readonly hasUnread: boolean;
};

const markerStateOf = ({ entry, hasUnread }: StateParams): TimelineMarkerState => {
  if (entry.agent.status === 'running') {
    return 'running';
  }
  if (entry.openQuestions.length > 0 || hasUnread) {
    return 'waiting';
  }
  return entry.agent.status;
};

export const TimelineAgentRow = ({
  entry,
  sessionId,
  timeLabel,
  depth,
  identity,
  diffComment,
  isExpanded,
  onToggle,
  onSeen,
}: Props) => {
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const isResolver = entry.agentKind === 'resolver';
  const hasUnread = agentHasUnread(entry.agent, false);
  const palette = agentKindPalette({ kind: entry.agentKind });
  const duration = durationOf({ entry });
  const hasBody =
    entry.agent.outputSummary != null ||
    entry.openQuestions.length > 0 ||
    entry.terminalQuestions.length > 0 ||
    entry.children.length > 0 ||
    diffComment != null;

  const navigate = () => {
    if (isResolver) {
      setActiveLens(sessionId, 'resolve');
    }
    void selectAgent(sessionId, entry.agent.id);
  };

  const cancelDwell = () => {
    if (dwellTimerRef.current != null) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  };
  const startDwell = () => {
    if (!hasUnread) {
      return;
    }
    cancelDwell();
    dwellTimerRef.current = setTimeout(() => {
      onSeen();
      dwellTimerRef.current = null;
    }, DWELL_MS);
  };
  useEffect(() => {
    return () => {
      if (dwellTimerRef.current != null) {
        clearTimeout(dwellTimerRef.current);
      }
    };
  }, []);

  return (
    <TimelineRow
      timeLabel={timeLabel}
      indent={depth}
      identity={identity}
      needsUser={entry.openQuestions.length > 0 || hasUnread}
      marker={<TimelineStatusMarker state={markerStateOf({ entry, hasUnread })} />}
      chip={
        isResolver ? null : (
          <Chip
            tone="neutral"
            label={palette.label}
            shape="badge"
            size="xs"
            width="md"
            uppercase
            className={cn('shrink-0', palette.fg)}
          />
        )
      }
      label={
        <>
          {entry.stepLabel != null ? (
            <span className="shrink-0 tabular-nums text-2xs text-muted-foreground/70">
              {entry.stepLabel}
            </span>
          ) : null}
          <span
            className={cn(
              'min-w-0 truncate text-sm text-foreground',
              entry.agent.status === 'running' && 'font-medium',
            )}
          >
            {entry.agent.name}
          </span>
        </>
      }
      meta={
        duration != null || entry.agent.status === 'failed' ? (
          <span className={cn('tabular-nums', entry.agent.status === 'failed' && 'text-danger')}>
            {[duration, entry.agent.status === 'failed' ? 'failed' : null]
              .filter((value): value is string => value != null)
              .join(' · ')}
          </span>
        ) : null
      }
      navigation={{ label: isResolver ? 'Open resolve' : 'Open chat', onNavigate: navigate }}
      continuation={
        entry.openQuestions.length > 0
          ? { label: 'Answer', onContinue: () => setActiveLens(sessionId, 'questions') }
          : null
      }
      isExpanded={isExpanded}
      onToggle={hasBody ? onToggle : undefined}
      disclosureLabel={`${isExpanded ? 'Collapse' : 'Expand'} ${entry.agent.name}`}
      onMouseEnter={startDwell}
      onMouseLeave={cancelDwell}
      body={
        hasBody ? (
          <>
            {entry.openQuestions.map((question) => (
              <TimelineQuestionInset key={question.id} question={question} sessionId={sessionId} />
            ))}
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
          </>
        ) : undefined
      }
    />
  );
};
