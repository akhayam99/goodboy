import { Button, Textarea } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { OUTCOME_ACTION } from '../../commentOutcomeCopy';
import { postOutcomeReply } from '../../postOutcomeReply';
import { useResolveItemDraft } from '../../hooks/useResolveItemDraft';
import type { ReviewEntry } from '../ReviewFlow/useReviewEntries';
import { useOutcomeRun } from './useOutcomeRun';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
  readonly reply: string;
  readonly isNote: boolean;
};

export const OutcomeReply = ({ sessionId, entry, reply, isNote }: Props) => {
  const closeResolvedNote = useAppStore((s) => s.closeResolvedNote);
  const resolveWithoutReply = useAppStore((s) => s.resolveWithoutReply);
  const draft = useResolveItemDraft({
    sessionId,
    threadId: entry.threadId,
    proposal: reply === '' ? null : reply,
  });
  const { isBusy, error, run } = useOutcomeRun();
  const { item, thread } = entry.row;
  const canPost = draft.reply.trim() !== '';

  const post = (): Promise<void> =>
    postOutcomeReply({
      state: useAppStore.getState(),
      sessionId,
      threadId: entry.threadId,
      itemId: item.id,
      revision: thread.revision,
      reply: draft.reply,
      isOnRemote: entry.remote !== null,
    });

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {isNote ? (
        reply !== '' && <p className="text-body text-muted-foreground">{reply}</p>
      ) : (
        <Textarea
          minRows={2}
          maxRows={6}
          autoGrow
          value={draft.reply}
          aria-label={OUTCOME_ACTION.reply}
          onChange={(event) => draft.setReply(event.target.value)}
        />
      )}
      <div className="flex items-center gap-2">
        {isNote ? (
          <Button
            size="sm"
            variant="primary"
            isBusy={isBusy}
            onClick={() =>
              void run(() => closeResolvedNote({ sessionId, threadId: entry.threadId }))
            }
          >
            {OUTCOME_ACTION.closeNote}
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="primary"
              isBusy={isBusy}
              disabled={!canPost}
              onClick={() => void run(post)}
            >
              {OUTCOME_ACTION.postReply}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isBusy}
              onClick={() => void run(() => resolveWithoutReply({ sessionId, itemId: item.id }))}
            >
              {OUTCOME_ACTION.resolveWithoutReply}
            </Button>
          </>
        )}
      </div>
      {error !== null && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
