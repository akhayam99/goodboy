import { memo, useEffect, useId } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { ROW_INTERACTIVE, cn, tintClasses } from '@goodboy/ui';
import { useSessionSummary } from '../../hooks/useSessionSummary';
import { sessionRowTitle } from '../../../session/sessionTitle';
import { SessionRowTitle } from '../SessionRowTitle';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { useRenameRequest } from '../../../actions/useRenameRequest';
import { useSelectRequest } from '../../../actions/useSelectRequest';
import { SESSION_HEADER_ANCHOR, sessionObjectKey } from '../../../actions/kinds/session';
import { sessionSelectionTarget } from '../../../actions/sessionSelectionTarget';
import { useSessionTitleRename } from '../../../session/hooks/useSessionTitleRename';
import { sessionNodeOf } from '../../../session/sessionNode';
import { overviewTitleHost } from '../../../session/overviewTitleHost';
import { TitleField } from '../../../../shared/components/TitleField';
import { StateNode } from '../../../../shared/components/StateNode';

type SelectionClickEvent = {
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
};

type RowAnchor = {
  readonly sessionId: SessionId;
  readonly anchor: HTMLElement;
};

export type EditingChange = {
  readonly sessionId: SessionId;
  readonly isEditing: boolean;
};

type Props = {
  readonly session: Session;
  readonly isActive: boolean;
  readonly isCurrent?: boolean;
  readonly isArchived?: boolean;
  readonly isSelected?: boolean;
  readonly isListbox?: boolean;
  readonly onEditingChange?: (params: EditingChange) => void;
  readonly getSelectedIds: () => ReadonlyArray<SessionId>;
  readonly onClearSelection: () => void;
  readonly onModifierClick: (id: SessionId, event: SelectionClickEvent) => void;
  readonly onSelect: (id: SessionId) => void;
  readonly onRowEnter: (params: RowAnchor) => void;
  readonly onRowLeave: () => void;
};

const SessionActivityItemView = ({
  session,
  isActive,
  isCurrent = false,
  isArchived = false,
  isSelected = false,
  isListbox = true,
  onEditingChange,
  getSelectedIds,
  onClearSelection,
  onModifierClick,
  onSelect,
  onRowEnter,
  onRowLeave,
}: Props) => {
  const summary = useSessionSummary({ session });
  const node = sessionNodeOf({ info: summary.info, isArchived });
  const rowTitle = sessionRowTitle({ session, tasks: summary.tasks });
  const { keys, title } = rowTitle;
  const sessionId = session.id as SessionId;
  const descriptionId = useId();
  const anchorKey = `sidebar:${sessionId}`;
  const rename = useSessionTitleRename({ sessionId, goal: session.goal, ...rowTitle });
  useRenameRequest({
    objectKey: sessionObjectKey({ sessionId }),
    anchorKeys: isActive ? [anchorKey, null, SESSION_HEADER_ANCHOR] : [anchorKey],
    onRename: () => {
      if (overviewTitleHost.start({ sessionId })) {
        return;
      }
      rename.start();
    },
  });
  useSelectRequest({
    objectKey: sessionObjectKey({ sessionId }),
    anchorKey,
    onSelect: () =>
      onModifierClick(sessionId, {
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
        altKey: true,
      }),
  });
  const menu = useObjectMenuTrigger({
    target: { kind: 'session', sessionId },
    anchorKey,
    viewing: { kind: 'selection', id: sessionId },
    onBeforeOpen: () =>
      sessionSelectionTarget({
        sessionId,
        selectedIds: getSelectedIds(),
        clearSelection: onClearSelection,
      }),
  });

  const isEditing = rename.editing;
  useEffect(() => {
    if (!isEditing) {
      return;
    }
    onEditingChange?.({ sessionId, isEditing: true });
    return () => onEditingChange?.({ sessionId, isEditing: false });
  }, [isEditing, onEditingChange, sessionId]);

  if (rename.editing) {
    return (
      <>
        <TitleField
          density="row"
          ariaLabel="Session title"
          draft={rename.draft}
          maxLength={rename.maxLength}
          used={rename.used}
          limit={rename.limit}
          error={rename.error}
          canRetry={rename.canRetry}
          isPending={rename.isPending}
          onRetry={() => void rename.commit()}
          lead={
            keys.length === 0 ? null : <SessionRowTitle keys={keys} title="" className="shrink-0" />
          }
          onDraftChange={rename.setDraft}
          onKeyDown={rename.onKeyDown}
          onBlur={rename.onBlur}
        />
      </>
    );
  }

  const isCalm =
    node.kind === 'idle' ||
    node.kind === 'queue' ||
    node.kind === 'done' ||
    node.kind === 'archived';

  return (
    <div className="relative">
      <button
        type="button"
        role={isListbox ? 'option' : undefined}
        data-select-id={session.id}
        data-node-kind={node.kind}
        aria-selected={isListbox ? isSelected : undefined}
        aria-pressed={isListbox ? undefined : isSelected}
        aria-current={isCurrent ? 'page' : undefined}
        aria-describedby={descriptionId}
        aria-keyshortcuts="Alt+Enter Alt+Space Shift+Enter Shift+F10"
        onClick={(event) => {
          if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
            onModifierClick(sessionId, event);
            return;
          }
          onSelect(sessionId);
        }}
        onContextMenu={menu.onContextMenu}
        onMouseEnter={(event) => onRowEnter({ sessionId, anchor: event.currentTarget })}
        onMouseLeave={onRowLeave}
        onFocus={(event) => onRowEnter({ sessionId, anchor: event.currentTarget })}
        onBlur={onRowLeave}
        onKeyDown={(event) => {
          menu.onKeyDown(event);
          const isActivation = event.key === 'Enter' || event.key === ' ';
          const isExtend = event.altKey || (event.shiftKey && event.key === 'Enter');
          if (!isActivation || !isExtend) {
            return;
          }
          event.preventDefault();
          onModifierClick(sessionId, event);
        }}
        className={cn(
          'group/session-row relative flex h-7 w-full select-none items-center gap-2 rounded-md px-2 text-left text-ui',
          ROW_INTERACTIVE,
          isCalm ? 'text-muted-foreground' : 'text-foreground',
          isActive && 'font-medium text-foreground',
          isCurrent && 'bg-selected',
          isSelected && cn(tintClasses('primary').bg, 'text-foreground'),
        )}
      >
        <SessionRowTitle keys={keys} title={title} className="flex-1" titleClassName="truncate" />
        <span data-row-state="" className="flex shrink-0 items-center">
          <StateNode node={node} isOnSelectedRow={isSelected || isCurrent} />
        </span>
      </button>
      <span id={descriptionId} className="sr-only">
        {summary.description}
      </span>
    </div>
  );
};

export const SessionActivityItem = memo(SessionActivityItemView);
