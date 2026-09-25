import type { ReactNode } from 'react';
import { FileCode } from 'lucide-react';
import type { ResolveQueueRow } from '../../buildResolveQueueRows';
import { hasConversationAgent } from '../../conversationAgentResult';
import { groupConversationsByFile } from '../../groupConversationsByFile';
import type { HeldBackKind } from '../../heldBackByThreadId';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ConversationAgentRow } from './ConversationAgentRow';
import { ConversationRow } from './ConversationRow';

export const NO_FILE_GROUP_LABEL = 'Pull request';

type Props = {
  readonly rows: ReadonlyArray<ResolveQueueRow>;
  readonly label: string;
  readonly now: number;
  readonly selectedThreadId: string | null;
  readonly checkedThreadIds: ReadonlySet<string>;
  readonly heldBack: ReadonlyMap<string, HeldBackKind>;
  readonly isCheckable: (row: ResolveQueueRow) => boolean;
  readonly onToggleChecked: (params: {
    readonly threadId: string;
    readonly isChecked: boolean;
  }) => void;
  readonly onOpen: (row: ResolveQueueRow) => void;
  readonly onOpenCommit: (params: { readonly row: ResolveQueueRow; readonly sha: string }) => void;
  readonly renderAction: (row: ResolveQueueRow) => ReactNode;
};

export const ConversationTree = ({
  rows,
  label,
  now,
  selectedThreadId,
  checkedThreadIds,
  heldBack,
  isCheckable,
  onToggleChecked,
  onOpen,
  onOpenCommit,
  renderAction,
}: Props) => (
  <div role="group" aria-label={label} className="flex min-w-0 flex-col gap-3">
    {groupConversationsByFile({ rows }).map((group) => (
      <section
        key={group.key}
        aria-label={group.path ?? NO_FILE_GROUP_LABEL}
        className="flex min-w-0 flex-col gap-0.5"
      >
        <h3 className="flex min-w-0 items-center gap-1.5 px-2 text-2xs leading-5 text-muted-foreground">
          <FileCode size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          <span className="min-w-0 truncate font-mono">{group.path ?? NO_FILE_GROUP_LABEL}</span>
          <span className="shrink-0 tabular-nums text-faint-foreground">{group.rows.length}</span>
        </h3>
        <ul className="flex min-w-0 flex-col gap-0.5">
          {group.rows.map((row) => (
            <li key={row.thread.threadId} className="flex min-w-0 list-none flex-col">
              <ConversationRow
                row={row}
                isSelected={row.thread.threadId === selectedThreadId}
                isChecked={checkedThreadIds.has(row.thread.threadId)}
                onToggleChecked={
                  isCheckable(row)
                    ? (isChecked) => onToggleChecked({ threadId: row.thread.threadId, isChecked })
                    : null
                }
                heldBack={heldBack.get(row.thread.threadId) ?? null}
                onOpen={() => onOpen(row)}
                action={renderAction(row)}
              />
              {hasConversationAgent({ row }) && (
                <ConversationAgentRow
                  row={row}
                  now={now}
                  onOpenCommit={({ sha }) => onOpenCommit({ row, sha })}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    ))}
  </div>
);
