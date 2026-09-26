import type { DiffComment, SessionId } from '@goodboy/types';
import type { AddReviewDraftInput } from '../../../store/slices/review-drafts/addReviewDraft';

type Params = {
  readonly sessionId: SessionId;
  readonly notes: ReadonlyArray<DiffComment>;
  readonly addReviewDraft: (input: AddReviewDraftInput) => Promise<unknown>;
  readonly resolveDiffComment: (sessionId: SessionId, commentId: string) => Promise<void>;
};

export type PostNotesResult = {
  readonly posted: number;
  readonly skipped: number;
};

export const POST_NOTES_LABEL = 'Post open notes to the PR';

export const postNotesResultMessage = ({ posted, skipped }: PostNotesResult): string => {
  const drafts =
    posted === 1
      ? '1 note is now a draft review comment'
      : `${posted} notes are now draft review comments`;
  if (skipped === 0) {
    return drafts;
  }
  return `${drafts}. ${skipped} without a line stayed as notes`;
};

const draftOf = ({
  sessionId,
  note,
}: {
  readonly sessionId: SessionId;
  readonly note: DiffComment;
}): AddReviewDraftInput | null => {
  const anchor = note.anchor;
  if (anchor === undefined) {
    return null;
  }
  const isRange = anchor.endLineNumber !== undefined && anchor.endLineNumber > anchor.lineNumber;
  return {
    sessionId,
    path: note.filePath,
    line: isRange ? (anchor.endLineNumber ?? anchor.lineNumber) : anchor.lineNumber,
    startLine: isRange ? anchor.lineNumber : null,
    side: anchor.side,
    body: note.body,
  };
};

export const postNotesToPr = async ({
  sessionId,
  notes,
  addReviewDraft,
  resolveDiffComment,
}: Params): Promise<PostNotesResult> => {
  let posted = 0;
  let skipped = 0;
  for (const note of notes) {
    const draft = draftOf({ sessionId, note });
    if (draft === null) {
      skipped += 1;
      continue;
    }
    await addReviewDraft(draft);
    await resolveDiffComment(sessionId, note.id);
    posted += 1;
  }
  return { posted, skipped };
};
