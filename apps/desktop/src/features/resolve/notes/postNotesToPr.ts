import type { DiffComment, SessionId } from '@goodboy/types';
import type { AddReviewDraftInput } from '../../../store/slices/review-drafts/addReviewDraft';
import type { ReviewTarget } from '../../../store/slices/review-drafts/resolveReviewTarget';
import { FILE_LEVEL_LINE } from '../../../store/slices/review-drafts/fileLevel';

type Params = {
  readonly sessionId: SessionId;
  readonly target: ReviewTarget;
  readonly notes: ReadonlyArray<DiffComment>;
  readonly addReviewDraft: (input: AddReviewDraftInput) => Promise<unknown>;
  readonly closeNote: (noteId: string) => Promise<void>;
};

export type PostNotesResult = {
  readonly posted: number;
};

export const moveNotesLabel = ({ count }: { readonly count: number }): string =>
  `Move ${count} to review draft`;

export const postNotesResultMessage = ({ posted }: PostNotesResult): string =>
  posted === 1 ? '1 note moved to your review draft' : `${posted} notes moved to your review draft`;

const draftOf = ({
  sessionId,
  target,
  note,
}: {
  readonly sessionId: SessionId;
  readonly target: ReviewTarget;
  readonly note: DiffComment;
}): AddReviewDraftInput => {
  const anchor = note.anchor;
  if (anchor === undefined) {
    return {
      sessionId,
      target,
      path: note.filePath,
      line: FILE_LEVEL_LINE,
      startLine: null,
      side: 'new',
      body: note.body,
    };
  }
  const isRange = anchor.endLineNumber !== undefined && anchor.endLineNumber > anchor.lineNumber;
  return {
    sessionId,
    target,
    path: note.filePath,
    line: isRange ? (anchor.endLineNumber ?? anchor.lineNumber) : anchor.lineNumber,
    startLine: isRange ? anchor.lineNumber : null,
    side: anchor.side,
    body: note.body,
  };
};

export const postNotesToPr = async ({
  sessionId,
  target,
  notes,
  addReviewDraft,
  closeNote,
}: Params): Promise<PostNotesResult> => {
  let posted = 0;
  for (const note of notes) {
    await addReviewDraft(draftOf({ sessionId, target, note }));
    await closeNote(note.id);
    posted += 1;
  }
  return { posted };
};
