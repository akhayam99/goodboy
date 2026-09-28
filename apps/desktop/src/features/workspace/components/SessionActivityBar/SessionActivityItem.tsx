import { CostBadge } from '../../../../features/providers/components/CostBadge';
import type { Session, SessionId } from '@goodboy/types';
import {
  Input,
  PANE_RHYTHM,
  TERMINAL_DIM,
  ToneBar,
  cn,
  formatUsd,
  InlineMarkdown,
} from '@goodboy/ui';
import { sessionTone } from '../../../session/components/sessionCardShell';
import { useSessionSummary } from '../../hooks/useSessionSummary';
import { SessionProgress } from '../SessionProgress';
import { sessionTitle } from '../../../session/sessionTitle';
import { SessionRowMeta } from './SessionRowMeta';
import { SessionRowNode } from './SessionRowNode';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { useRenameRequest } from '../../../actions/useRenameRequest';
import { sessionObjectKey } from '../../../actions/kinds/session';
import { sessionSelectionTarget } from '../../../actions/sessionSelectionTarget';
import { useSessionTitleRename } from '../../../session/hooks/useSessionTitleRename';

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
  readonly selectedIds: ReadonlyArray<SessionId>;
  readonly onClearSelection: () => void;
  readonly onModifierClick: (id: SessionId, event: SelectionClickEvent) => void;
  readonly onClick: () => void;
};

export const SessionActivityItem = ({
  session,
  isActive,
  isDimmed = false,
  isSelected = false,
  selectedIds,
  onClearSelection,
  onModifierClick,
  onClick,
}: Props) => {
  const summary = useSessionSummary({ session });
  const tone = sessionTone({ stage: summary.stage, attention: summary.attention });
  const hasCost = summary.cost > 0;
  const isReasonInMeta =
    summary.attention === 'open-question' && summary.actionable?.kind === 'questions';
  const sessionId = session.id as SessionId;
  const anchorKey = `sidebar:${sessionId}`;
  const rename = useSessionTitleRename({ sessionId, currentTitle: session.goal });
  useRenameRequest({
    objectKey: sessionObjectKey({ sessionId }),
    anchorKeys: [anchorKey],
    onRename: rename.start,
  });
  const menu = useObjectMenuTrigger({
    target: { kind: 'session', sessionId },
    anchorKey,
    onBeforeOpen: () =>
      sessionSelectionTarget({ sessionId, selectedIds, clearSelection: onClearSelection }),
  });

  if (rename.editing) {
    return (
      <div
        className={cn('flex w-full flex-col gap-1 rounded-md', PANE_RHYTHM.navRail.row, 'pl-3.5')}
      >
        <Input
          autoFocus
          value={rename.draft}
          maxLength={rename.maxLength}
          onChange={(event) => rename.setDraft(event.target.value)}
          onBlur={() => void rename.commit()}
          onKeyDown={rename.onKeyDown}
          aria-label="Session title"
        />
        {rename.error === null ? null : (
          <span className="truncate text-secondary text-danger">{rename.error}</span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      data-select-id={session.id}
      aria-pressed={isSelected}
      aria-keyshortcuts="Alt+Enter Alt+Space Shift+F10"
      onClick={(event) => {
        if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
          onModifierClick(session.id as SessionId, event);
          return;
        }
        onClick();
      }}
      onContextMenu={menu.onContextMenu}
      onKeyDown={(event) => {
        menu.onKeyDown(event);
        if (!event.altKey || (event.key !== 'Enter' && event.key !== ' ')) {
          return;
        }
        event.preventDefault();
        onModifierClick(session.id as SessionId, event);
      }}
      className={cn(
        '@container group/session-row relative flex w-full cursor-pointer items-start gap-2 rounded-md text-left motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        PANE_RHYTHM.navRail.row,
        'pl-3.5',
        (isActive || isSelected) && 'bg-selected font-medium text-foreground',
        isDimmed && TERMINAL_DIM,
      )}
    >
      <ToneBar tone={tone.tone} density="row" isBreathing={tone.isBreathing} />
      <SessionRowNode
        stage={summary.stage}
        attention={summary.attention}
        tone={summary.tone}
        prState={summary.prState}
        isSelected={isSelected}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex w-full min-w-0 items-baseline gap-2">
          <InlineMarkdown
            text={sessionTitle({ session })}
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
              {isReasonInMeta ? null : summary.reason}
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
