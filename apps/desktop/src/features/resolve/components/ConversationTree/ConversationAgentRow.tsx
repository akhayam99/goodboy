import { GitCommitHorizontal } from 'lucide-react';
import { Tooltip, WORK_META_COLUMN, WORK_ROW, WorkNode, cn } from '@goodboy/ui';
import { formatDuration } from '../../../chat/utils/format-duration';
import { modelLabel } from '../../../chat/utils/chat-constants';
import type { ResolveQueueRow } from '../../buildResolveQueueRows';
import { conversationAgentResult } from '../../conversationAgentResult';
import { shortSha } from '../../resolveItemCopy';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly row: ResolveQueueRow;
  readonly now: number;
  readonly onOpenCommit: (params: { readonly sha: string }) => void;
};

const elapsedOf = ({ row, now }: { readonly row: ResolveQueueRow; readonly now: number }) => {
  const startedAt = row.attempt?.startedAt ?? null;
  if (startedAt === null) {
    return '';
  }
  return formatDuration({ durationMs: Math.max(0, (row.attempt?.endedAt ?? now) - startedAt) });
};

export const RESOLVER_ROLE_LABEL = 'Resolver';

export const ConversationAgentRow = ({ row, now, onOpenCommit }: Props) => {
  const result = conversationAgentResult({ row });
  const attempt = row.attempt;
  const more = row.coveredThreadIds.length;
  return (
    <div
      data-conversation-agent={row.thread.threadId}
      className={cn(
        WORK_ROW.container,
        'ml-4 flex min-h-8 min-w-0 items-center gap-2.5 border-l border-border py-1 pl-3 pr-2',
      )}
    >
      <WorkNode state={result.node} label={result.lead} mark={{ kind: 'dot' }} />
      <span className="shrink-0 rounded-sm bg-subtle px-1.5 text-2xs leading-4 text-muted-foreground">
        {RESOLVER_ROLE_LABEL}
      </span>
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5 text-xs leading-4 text-muted-foreground">
        <span className="min-w-0 truncate">{result.lead}</span>
        {result.sha !== null && (
          <Tooltip content={result.sha} side="top">
            <button
              type="button"
              onClick={() => {
                if (result.sha !== null) {
                  onOpenCommit({ sha: result.sha });
                }
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-sm font-mono tabular-nums text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <GitCommitHorizontal size={ICON_SIZE.row} aria-hidden />
              {shortSha({ sha: result.sha })}
            </button>
          </Tooltip>
        )}
        {result.sha !== null && result.isPushed && (
          <span className="shrink-0 text-faint-foreground">on origin</span>
        )}
        {more > 0 && <span className="shrink-0 text-faint-foreground">with {more} more</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2 text-2xs leading-4 tabular-nums text-muted-foreground">
        <span className={WORK_META_COLUMN.routing}>
          {attempt === null ? null : (
            <span className={WORK_META_COLUMN.routingName}>
              {modelLabel(attempt.model)}
              {attempt.effort === null
                ? ''
                : ` · ${attempt.effort.charAt(0).toUpperCase()}${attempt.effort.slice(1)}`}
            </span>
          )}
        </span>
        <span className={WORK_META_COLUMN.time}>{elapsedOf({ row, now })}</span>
      </span>
    </div>
  );
};
