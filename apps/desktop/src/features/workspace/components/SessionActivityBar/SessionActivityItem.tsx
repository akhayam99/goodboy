import { memo, useId } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { Input, ROW_INTERACTIVE, SelectionCheckbox, cn, inlineMarkdownText } from '@goodboy/ui';
import { useSessionSummary } from '../../hooks/useSessionSummary';
import { sessionRowTitle } from '../../../session/sessionTitle';
import { SessionRowTitle } from '../SessionRowTitle';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { useRenameRequest } from '../../../actions/useRenameRequest';
import { SESSION_HEADER_ANCHOR, sessionObjectKey } from '../../../actions/kinds/session';
import { sessionSelectionTarget } from '../../../actions/sessionSelectionTarget';
import { useSessionTitleRename } from '../../../session/hooks/useSessionTitleRename';
import { sessionNodeOf } from '../../../session/sessionNode';
import { SessionStateNode } from './SessionStateNode';

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

type Props = {
  readonly session: Session;
  readonly isActive: boolean;
  readonly isCurrent?: boolean;
  readonly isArchived?: boolean;
  readonly isSelected?: boolean;
  readonly getSelectedIds: () => ReadonlyArray<SessionId>;
  readonly onClearSelection: () => void;
  readonly onModifierClick: (id: SessionId, event: SelectionClickEvent) => void;
  readonly onToggleSelect: (id: SessionId, event: { readonly shiftKey: boolean }) => void;
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
  getSelectedIds,
  onClearSelection,
  onModifierClick,
  onToggleSelect,
  onSelect,
  onRowEnter,
  onRowLeave,
}: Props) => {
  const summary = useSessionSummary({ session });
  const node = sessionNodeOf({ info: summary.info, isArchived });
  const { keys, title } = sessionRowTitle({ session, tasks: summary.tasks });
  const sessionId = session.id as SessionId;
  const descriptionId = useId();
  const anchorKey = `sidebar:${sessionId}`;
  const rename = useSessionTitleRename({ sessionId, currentTitle: session.goal });
  useRenameRequest({
    objectKey: sessionObjectKey({ sessionId }),
    anchorKeys: isActive ? [anchorKey, null, SESSION_HEADER_ANCHOR] : [anchorKey],
    onRename: rename.start,
  });
  const menu = useObjectMenuTrigger({
    target: { kind: 'session', sessionId },
    anchorKey,
    onBeforeOpen: () =>
      sessionSelectionTarget({
        sessionId,
        selectedIds: getSelectedIds(),
        clearSelection: onClearSelection,
      }),
  });

  if (rename.editing) {
    return (
      <div className="flex w-full flex-col gap-1 rounded-md px-2 py-1">
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
          <span className="truncate text-meta text-danger">{rename.error}</span>
        )}
      </div>
    );
  }

  const isCalm =
    node.kind === 'idle' ||
    node.kind === 'queue' ||
    node.kind === 'done' ||
    node.kind === 'archived';

  return (
    <div className="group/select-row relative">
      <SelectionCheckbox
        checked={isSelected}
        label={`Select ${inlineMarkdownText({ text: title })}`}
        onToggle={(event) => onToggleSelect(sessionId, event)}
        className="absolute left-1 top-1"
      />
      <button
        type="button"
        data-select-id={session.id}
        data-node-kind={node.kind}
        aria-pressed={isSelected}
        aria-current={isCurrent ? 'page' : undefined}
        aria-describedby={descriptionId}
        aria-keyshortcuts="Alt+Enter Alt+Space Shift+F10"
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
          if (!event.altKey || (event.key !== 'Enter' && event.key !== ' ')) {
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
          isSelected && 'bg-selected text-foreground',
          isCurrent && 'bg-selected',
        )}
      >
        <SessionStateNode
          node={node}
          isOnSelectedRow={isSelected || isCurrent}
          className="group-focus-within/select-row:invisible group-hover/select-row:invisible group-data-[selecting=true]/select-list:invisible"
        />
        <SessionRowTitle keys={keys} title={title} className="flex-1" titleClassName="truncate" />
      </button>
      <span id={descriptionId} className="sr-only">
        {summary.description}
      </span>
    </div>
  );
};

export const SessionActivityItem = memo(SessionActivityItemView);
