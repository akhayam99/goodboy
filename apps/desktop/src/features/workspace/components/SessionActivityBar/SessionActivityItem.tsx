import { CostBadge } from '../../../../features/providers/components/CostBadge';
import type { Session, SessionId } from '@goodboy/types';
import { PANE_RHYTHM, TERMINAL_DIM, cn, formatUsd, tintClasses, InlineMarkdown } from '@goodboy/ui';
import { sessionRail } from '../../../session/components/sessionCardShell';
import { useSessionSummary } from '../../hooks/useSessionSummary';
import { SessionProgress } from '../SessionProgress';
import { SessionRowMeta } from './SessionRowMeta';
import { SessionRowNode } from './SessionRowNode';

type SelectionClickEvent = {
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
};

type Props = {
  readonly session: Session;
  readonly isActive: boolean;
  readonly isDimmed?: boolean;
  readonly isSelected?: boolean;
  readonly onModifierClick: (id: SessionId, event: SelectionClickEvent) => void;
  readonly onClick: () => void;
};

export const SessionActivityItem = ({
  session,
  isActive,
  isDimmed = false,
  isSelected = false,
  onModifierClick,
  onClick,
}: Props) => {
  const summary = useSessionSummary({ session });
  const rail = sessionRail({ stage: summary.stage, attention: summary.attention });
  const hasCost = summary.cost > 0;

  return (
    <button
      type="button"
      data-select-id={session.id}
      aria-pressed={isSelected}
      aria-keyshortcuts="Alt+Enter Alt+Space"
      onClick={(event) => {
        if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
          onModifierClick(session.id as SessionId, event);
          return;
        }
        onClick();
      }}
      onKeyDown={(event) => {
        if (!event.altKey || (event.key !== 'Enter' && event.key !== ' ')) {
          return;
        }
        event.preventDefault();
        onModifierClick(session.id as SessionId, event);
      }}
      className={cn(
        '@container group/session-row flex w-full cursor-pointer items-start gap-2 rounded-md border-l-2 border-l-transparent text-left motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        PANE_RHYTHM.navRail.row,
        rail,
        isActive && 'bg-muted font-medium text-foreground',
        isSelected && cn(tintClasses('primary').bg, 'ring-1', tintClasses('primary').ring),
        isDimmed && TERMINAL_DIM,
      )}
    >
      <SessionRowNode
        stage={summary.stage}
        attention={summary.attention}
        tone={summary.tone}
        prState={summary.prState}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex w-full min-w-0 items-baseline gap-2">
          <InlineMarkdown
            text={session.goal}
            className="min-w-0 flex-1 truncate text-row text-foreground"
          />
          <span
            data-testid="session-row-trailing"
            className="w-12 shrink-0 text-right text-meta text-faint-foreground"
          >
            <span className={cn(hasCost && 'group-hover/session-row:hidden')}>{summary.age}</span>
            {hasCost ? (
              <CostBadge
                value={summary.cost}
                title={`Session spend: ${formatUsd(summary.cost)} (excludes summarizer)`}
                className="hidden font-sans text-meta font-medium text-muted-foreground group-hover/session-row:inline"
              />
            ) : null}
          </span>
        </span>
        <span className="flex w-full min-w-0 items-center gap-2">
          {summary.progress !== null ? (
            <SessionProgress progress={summary.progress} tone={summary.tone} className="flex-1" />
          ) : (
            <span className="min-w-0 flex-1 truncate text-secondary text-muted-foreground">
              {summary.reason}
            </span>
          )}
          {summary.meta.map((item) => (
            <SessionRowMeta key={item.kind} item={item} />
          ))}
        </span>
      </span>
      <span className="sr-only">{summary.description}</span>
    </button>
  );
};
