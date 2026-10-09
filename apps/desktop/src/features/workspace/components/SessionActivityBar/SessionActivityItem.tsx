import { memo, useId } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { Input, ROW_INTERACTIVE, SelectionCheckbox, cn, inlineMarkdownText } from '@goodboy/ui';
import { useSessionSummary } from '../../hooks/useSessionSummary';
import { sessionRowTitle } from '../../../session/sessionTitle';
import { SessionRowTitle } from '../SessionRowTitle';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { useRenameRequest } from '../../../actions/useRenameRequest';
import { sessionObjectKey } from '../../../actions/kinds/session';
import { sessionSelectionTarget } from '../../../actions/sessionSelectionTarget';
import { useSessionTitleRename } from '../../../session/hooks/useSessionTitleRename';
import { useSessionPin } from '../../../actions/useSessionPin';
import type { CurrentSign } from './currentSign';
import { PagesChevron } from './PagesChevron';
import { PinSlotButton } from './PinSlotButton';
import { sessionNodeOf } from './sessionNode';
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
  readonly sign?: CurrentSign | null;
  readonly isPagesFolded?: boolean;
  readonly isArchived?: boolean;
  readonly isSelected?: boolean;
  readonly getSelectedIds: () => ReadonlyArray<SessionId>;
  readonly onClearSelection: () => void;
  readonly onModifierClick: (id: SessionId, event: SelectionClickEvent) => void;
  readonly onToggleSelect: (id: SessionId, event: { readonly shiftKey: boolean }) => void;
  readonly onSelect: (id: SessionId) => void;
  readonly onRowEnter: (params: RowAnchor) => void;
  readonly onRowLeave: () => void;
  readonly onPagesFoldChange?: (isFolded: boolean) => void;
};

type PadParams = {
  readonly canFoldPages: boolean;
  readonly isFolded: boolean;
  readonly isArchived: boolean;
};

const trailingPadOf = ({ canFoldPages, isFolded, isArchived }: PadParams): string => {
  if (isArchived) {
    return '';
  }
  if (!canFoldPages) {
    return 'group-focus-within/select-row:pr-8 group-hover/select-row:pr-8';
  }
  return cn('group-focus-within/select-row:pr-14 group-hover/select-row:pr-14', isFolded && 'pr-7');
};

const SessionActivityItemView = ({
  session,
  isActive,
  sign = null,
  isPagesFolded = false,
  isArchived = false,
  isSelected = false,
  getSelectedIds,
  onClearSelection,
  onModifierClick,
  onToggleSelect,
  onSelect,
  onRowEnter,
  onRowLeave,
  onPagesFoldChange,
}: Props) => {
  const summary = useSessionSummary({ session });
  const node = sessionNodeOf({ info: summary.info, isArchived });
  const { keys, title } = sessionRowTitle({ session, tasks: summary.tasks });
  const sessionId = session.id as SessionId;
  const descriptionId = useId();
  const anchorKey = `sidebar:${sessionId}`;
  const pin = useSessionPin({ session });
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

  const canFoldPages = isActive && !isArchived && onPagesFoldChange !== undefined;
  const trailingPad = trailingPadOf({ canFoldPages, isFolded: isPagesFolded, isArchived });
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
        aria-current={sign === 'session' ? 'page' : undefined}
        data-current-sign={sign ?? undefined}
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
          if (canFoldPages && event.key === 'ArrowRight') {
            event.preventDefault();
            onPagesFoldChange(false);
            return;
          }
          if (canFoldPages && event.key === 'ArrowLeft') {
            event.preventDefault();
            onPagesFoldChange(true);
            return;
          }
          if (!event.altKey || (event.key !== 'Enter' && event.key !== ' ')) {
            return;
          }
          event.preventDefault();
          onModifierClick(sessionId, event);
        }}
        className={cn(
          'group/session-row relative flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-row',
          ROW_INTERACTIVE,
          isCalm ? 'text-muted-foreground' : 'text-foreground',
          isActive && 'font-medium text-foreground',
          isSelected && 'bg-selected text-foreground',
          sign === 'session' && 'bg-selected',
          trailingPad,
        )}
      >
        <SessionStateNode
          node={node}
          className="group-focus-within/select-row:invisible group-hover/select-row:invisible group-data-[selecting=true]/select-list:invisible"
        />
        <SessionRowTitle keys={keys} title={title} className="flex-1" titleClassName="truncate" />
      </button>
      {isArchived ? null : (
        <span className="absolute right-1 top-1 flex items-center gap-0.5">
          {canFoldPages ? (
            <PagesChevron
              title={inlineMarkdownText({ text: title })}
              isFolded={isPagesFolded}
              onToggle={() => onPagesFoldChange(!isPagesFolded)}
            />
          ) : null}
          <PinSlotButton isPinned={pin.isPinned} label={pin.label} onToggle={pin.toggle} />
        </span>
      )}
      <span id={descriptionId} className="sr-only">
        {summary.description}
      </span>
    </div>
  );
};

export const SessionActivityItem = memo(SessionActivityItemView);
