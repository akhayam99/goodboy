import { memo, useId } from 'react';
import { cn, Input, Tooltip, InlineMarkdown, inlineMarkdownText, ToneBar } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { CardAction, CardActionSlot, FOCUS_RING } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { sessionCardShell } from '../../../../session/components/sessionCardShell';
import { stageTrackOf } from '../../../../session/stageTrackOf';
import type { BoardNavigation } from '../useBoardNavigation';
import { useAttentionAction } from './useAttentionAction';
import { useDynamicActions } from './useDynamicActions';
import { useObjectMenuTrigger } from '../../../../actions/useObjectMenuTrigger';
import { useRenameRequest } from '../../../../actions/useRenameRequest';
import { useSelectRequest } from '../../../../actions/useSelectRequest';
import { useSessionRowFacts } from '../../../hooks/useSessionRowFacts';
import { sessionObjectKey } from '../../../../actions/kinds/session';
import { sessionSelectionTarget } from '../../../../actions/sessionSelectionTarget';
import { useSessionTitleRename } from '../../../../session/hooks/useSessionTitleRename';
import { SessionSignal } from '../SessionSignal';
import { useSessionSignal } from '../useSessionSignal';
import { projectLineOf } from '../projectLineOf';

type CardSelectionEvent = {
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
};

type CardHover = {
  readonly sessionId: SessionId;
  readonly anchor: HTMLElement;
};

type StageBoardCardProps = {
  readonly session: Session;
  readonly nav: BoardNavigation;
  readonly archived?: boolean;
  readonly selected?: boolean;
  readonly getSelectedIds?: () => ReadonlyArray<SessionId>;
  readonly onClearSelection?: () => void;
  readonly onModifierClick?: (id: SessionId, event: CardSelectionEvent) => void;
  readonly onRestore?: (session: Session) => void;
  readonly onHoverEnter?: (target: CardHover) => void;
  readonly onHoverLeave?: () => void;
};

const NO_SELECTION: ReadonlyArray<SessionId> = [];
const noSelectedIds = (): ReadonlyArray<SessionId> => NO_SELECTION;

export const StageBoardCard = memo(function StageBoardCard({
  session,
  nav,
  archived,
  selected,
  getSelectedIds = noSelectedIds,
  onClearSelection,
  onModifierClick,
  onRestore,
  onHoverEnter,
  onHoverLeave,
}: StageBoardCardProps) {
  const id = session.id as SessionId;
  const stateWordId = useId();
  const isArchived = archived === true;
  const { summary, node, rowTitle, title } = useSessionRowFacts({ session, isArchived });
  const { stage } = summary;
  const signal = useSessionSignal({ session, isArchived });
  const track = stageTrackOf({ stage, isArchived });
  const mounts = useAppStore((s) => s.sessionProjectMounts?.[id] ?? EMPTY_ARRAY);
  const projectLine = projectLineOf({ mounts });
  const dynamicActions = useDynamicActions(session, nav, stage);
  const attentionAction = useAttentionAction({ session, info: summary.info });

  const [visibleAction = attentionAction ?? undefined] = dynamicActions;
  const anchorKey = `board:${id}`;
  const rename = useSessionTitleRename({ sessionId: id, goal: session.goal, ...rowTitle });
  useRenameRequest({
    objectKey: sessionObjectKey({ sessionId: id }),
    anchorKeys: [anchorKey],
    onRename: rename.start,
  });
  useSelectRequest({
    objectKey: sessionObjectKey({ sessionId: id }),
    anchorKey,
    onSelect: () =>
      onModifierClick?.(id, { shiftKey: false, metaKey: false, ctrlKey: false, altKey: true }),
  });
  const menu = useObjectMenuTrigger({
    target: { kind: 'session', sessionId: id },
    anchorKey,
    viewing: { kind: 'selection', id },
    onBeforeOpen: () =>
      sessionSelectionTarget({
        sessionId: id,
        selectedIds: getSelectedIds(),
        clearSelection: () => onClearSelection?.(),
      }),
  });
  const handlePrClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    nav.openPullRequest(session);
  };

  const selectFromEvent = (event: CardSelectionEvent): boolean => {
    if (onModifierClick && (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey)) {
      onModifierClick(id, event);
      return true;
    }
    return false;
  };

  return (
    <article
      data-archived={archived || undefined}
      data-select-id={id}
      onContextMenu={menu.onContextMenu}
      onMouseEnter={(event) => onHoverEnter?.({ sessionId: id, anchor: event.currentTarget })}
      onMouseLeave={() => onHoverLeave?.()}
      onClick={(event) => {
        if (selectFromEvent(event)) {
          return;
        }
        nav.selectCard(session);
      }}
      className={cn(
        'group/session-card grid min-h-24 shrink-0 cursor-pointer grid-cols-[minmax(0,1fr)_auto] grid-rows-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 p-3 pl-5 text-left select-none',
        sessionCardShell({ selected }),
      )}
    >
      <ToneBar tone={track.tone} density="card" isBreathing={track.isBreathing} />
      {rename.editing ? (
        <Input
          autoFocus
          value={rename.draft}
          maxLength={rename.maxLength}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => rename.setDraft(event.target.value)}
          onBlur={() => void rename.commit()}
          onKeyDown={rename.onKeyDown}
          aria-label="Session title"
          className="min-w-0 self-start"
        />
      ) : (
        <Tooltip content={inlineMarkdownText({ text: title })}>
          <button
            type="button"
            aria-pressed={selected === true}
            aria-describedby={stateWordId}
            aria-keyshortcuts="Alt+Enter Shift+Enter Shift+F10"
            onFocus={(event) =>
              onHoverEnter?.({
                sessionId: id,
                anchor: event.currentTarget.closest('article') ?? event.currentTarget,
              })
            }
            onBlur={() => onHoverLeave?.()}
            onKeyDown={(event) => {
              menu.onKeyDown(event);
              if (event.key !== 'Enter' && event.key !== ' ') {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              if (
                (event.altKey || (event.shiftKey && event.key === 'Enter')) &&
                selectFromEvent(event)
              ) {
                return;
              }
              nav.selectCard(session);
            }}
            className={cn('min-w-0 cursor-pointer self-start rounded-sm text-left', FOCUS_RING)}
          >
            <InlineMarkdown text={title} className="line-clamp-2 text-row text-foreground" />
          </button>
        </Tooltip>
      )}
      <span id={stateWordId} className="sr-only">
        {node.label}
      </span>

      <span className="col-start-2 row-start-1 flex items-center gap-1 self-start">
        <CardActionSlot label="Session quick actions">
          {!isArchived && visibleAction !== undefined && (
            <CardAction
              key={visibleAction.key}
              icon={visibleAction.icon}
              tone={visibleAction.tone}
              label={visibleAction.label}
              onClick={visibleAction.onClick}
            />
          )}
          {isArchived && (
            <CardAction
              icon={CONCEPT_ICONS.restore}
              tone="primary"
              label="Restore"
              onClick={() => onRestore?.(session)}
            />
          )}
        </CardActionSlot>
      </span>

      <div className="col-span-full row-start-2 flex min-h-5 min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span
          data-slot="card-project"
          className="min-w-0 break-words text-meta text-muted-foreground"
        >
          {projectLine}
        </span>
        <span
          data-slot="card-signal"
          className="flex min-w-fit max-w-full flex-1 items-center justify-end"
        >
          <SessionSignal signal={signal} onOpenRequest={handlePrClick} />
        </span>
      </div>
    </article>
  );
});
