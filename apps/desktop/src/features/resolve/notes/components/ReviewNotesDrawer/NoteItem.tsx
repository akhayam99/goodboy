import { Button, SelectionCheckbox } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { ReviewCommentController } from '../../../hooks/useReviewCommentController';
import { ReviewComment } from '../../../components/ReviewFlow/ReviewComment';
import type { ReviewEntry } from '../../../components/ReviewFlow/useReviewEntries';
import { noteIdOfThread } from '../../noteThread';
import { REVIEW_NOTES_COPY } from '../../reviewNotesCopy';

type Inclusion = {
  readonly isIncluded: boolean;
  readonly onToggle: () => void;
};

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly controller: ReviewCommentController;
  readonly inclusion: Inclusion | null;
  readonly onJump: () => void;
  readonly onSelect: (threadId: string) => void;
};

const CLOSE_ACTION = 'reviewComment.resolveNoReply';

const CLOSEABLE_AFTER_DRAFT: ReadonlySet<string> = new Set(['ready', 'edited', 'outdated']);

export const NoteItem = ({
  sessionId,
  entry,
  entries,
  controller,
  inclusion,
  onJump,
  onSelect,
}: Props) => {
  const discardDiffComments = useAppStore((s) => s.discardDiffComments);
  const binding = controller.bind(entry.threadId);
  const { row, state } = entry;
  const noteId = row.thread.diffCommentId ?? noteIdOfThread({ threadId: entry.threadId });
  const isBusy = binding.pendingActionId !== null || binding.isSubmitting;

  const noteActions =
    state === 'new' ? (
      <>
        <Button
          size="sm"
          variant="ghost"
          disabled={isBusy}
          onClick={() => binding.onRun(CLOSE_ACTION)}
        >
          {REVIEW_NOTES_COPY.closeNote}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={isBusy || noteId === null}
          onClick={() => {
            if (noteId !== null) {
              void discardDiffComments({ sessionId, ids: [noteId] });
            }
          }}
        >
          {REVIEW_NOTES_COPY.deleteNote}
        </Button>
      </>
    ) : CLOSEABLE_AFTER_DRAFT.has(state) ? (
      <Button
        size="sm"
        variant="ghost"
        disabled={isBusy}
        onClick={() => binding.onRun(CLOSE_ACTION)}
      >
        {REVIEW_NOTES_COPY.closeTheNote}
      </Button>
    ) : null;

  return (
    <li
      data-note-thread={entry.threadId}
      className={inclusion === null ? 'relative list-none' : 'relative list-none pl-7'}
    >
      {inclusion === null ? null : (
        <SelectionCheckbox
          checked={inclusion.isIncluded}
          label={REVIEW_NOTES_COPY.include}
          onToggle={inclusion.onToggle}
          isAlwaysShown
          className="absolute left-0 top-0.5"
        />
      )}
      <ReviewComment
        sessionId={sessionId}
        entry={entry}
        entries={entries}
        hunk={
          <Button size="xs" variant="ghost" className="w-fit" onClick={onJump}>
            {REVIEW_NOTES_COPY.jumpToFile}
          </Button>
        }
        noteActions={noteActions}
        {...binding}
        onSelect={onSelect}
        onTryAgain={() => void controller.retryRun(entry.threadId)}
        onStartOver={() => void controller.startOver(entry.threadId)}
      />
    </li>
  );
};
