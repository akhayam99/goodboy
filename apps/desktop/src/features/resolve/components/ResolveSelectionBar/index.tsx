import { useState } from 'react';
import { Button, Tooltip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { CommentThread } from '../../../github/comment-threads';
import type { ResolveQueueRow } from '../../buildResolveQueueRows';
import {
  RESOLVE_QUEUE_ACTION_LABEL,
  RESOLVE_RUN_IN_PROGRESS,
  approveCountLabel,
  nothingToApproveLabel,
  resolveCountLabel,
  resolveSelectionLabel,
} from '../../resolveQueueCopy';
import { selectionApproval } from '../../selectionApproval';
import { ResolveWithPopover } from '../ResolveWithPopover';

type Props = {
  readonly sessionId: SessionId;
  readonly rows: ReadonlyArray<ResolveQueueRow>;
  readonly checkedThreadIds: ReadonlySet<string>;
  readonly threads: ReadonlyArray<CommentThread>;
  readonly isRunLive: boolean;
  readonly onClear: () => void;
};

export const ResolveSelectionBar = ({
  sessionId,
  rows,
  checkedThreadIds,
  threads,
  isRunLive,
  onClear,
}: Props) => {
  const acceptResolveQueueItem = useAppStore((s) => s.acceptResolveQueueItem);
  const deferResolveQueueItem = useAppStore((s) => s.deferResolveQueueItem);
  const reportError = useAppStore((s) => s.reportError);
  const [isBusy, setIsBusy] = useState(false);
  const count = checkedThreadIds.size;
  const { approvable, nothingToApprove } = selectionApproval({
    rows,
    threadIds: checkedThreadIds,
  });
  const parkable = rows.filter(
    (row) =>
      checkedThreadIds.has(row.thread.threadId) &&
      row.status !== 'later' &&
      row.status !== 'resolved' &&
      row.item.integratedSha === null,
  );

  const runAll = async ({
    title,
    work,
  }: {
    readonly title: string;
    readonly work: () => Promise<void>;
  }): Promise<void> => {
    setIsBusy(true);
    try {
      await work();
      onClear();
    } catch (error) {
      void reportError({ title, error, sessionId });
    } finally {
      setIsBusy(false);
    }
  };

  const onApprove = (): void => {
    void runAll({
      title: "Couldn't approve every selected comment",
      work: async () => {
        for (const row of approvable) {
          await acceptResolveQueueItem({
            sessionId,
            itemId: row.item.id,
            revision: row.item.candidateRevision,
            reply: row.thread.replyDraft ?? '',
          });
        }
      },
    });
  };

  const onLater = (): void => {
    void runAll({
      title: "Couldn't park every selected comment",
      work: async () => {
        for (const row of parkable) {
          await deferResolveQueueItem({ sessionId, itemId: row.item.id });
        }
      },
    });
  };

  const approveButton = (
    <Button
      size="sm"
      variant="secondary"
      isBusy={isBusy}
      disabled={approvable.length === 0}
      onClick={onApprove}
    >
      {approveCountLabel({ count: approvable.length })}
    </Button>
  );

  return (
    <div
      role="toolbar"
      aria-label={resolveSelectionLabel({ count })}
      className="flex min-w-0 flex-wrap items-center gap-2 rounded-md bg-subtle px-3 py-1.5"
    >
      <span className="min-w-0 truncate text-label font-medium text-foreground">
        {resolveSelectionLabel({ count })}
      </span>
      <Button size="sm" variant="ghost" onClick={onClear}>
        {RESOLVE_QUEUE_ACTION_LABEL.clearSelection}
      </Button>
      <span className="min-w-0 flex-1 truncate text-secondary text-muted-foreground">
        {nothingToApprove > 0 && approvable.length > 0
          ? nothingToApproveLabel({ count: nothingToApprove })
          : ''}
      </span>
      <Button
        size="sm"
        variant="ghost"
        disabled={isBusy || parkable.length === 0}
        onClick={onLater}
      >
        {RESOLVE_QUEUE_ACTION_LABEL.later}
      </Button>
      {nothingToApprove > 0 && approvable.length === 0 ? (
        <Tooltip content={nothingToApproveLabel({ count: nothingToApprove })} side="top">
          <span>{approveButton}</span>
        </Tooltip>
      ) : (
        approveButton
      )}
      <ResolveWithPopover
        sessionId={sessionId}
        threads={threads}
        label={resolveCountLabel({ count: threads.length })}
        isDisabled={isRunLive || threads.length === 0}
        disabledReason={RESOLVE_RUN_IN_PROGRESS}
        onStarted={onClear}
      />
    </div>
  );
};
