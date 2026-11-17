import { useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { ItemWorkLine } from '../../../live-state/itemWork/ItemWorkLine';
import type { CommentRowResult } from '../../commentRowResultOf';
import type { CommentWork } from '../../commentWorkOf';
import { CommentFixReview } from './CommentFixReview';
import { CommentResultAction } from './CommentResultAction';
import { CommentWorkLine, type StopWorkParams } from './CommentWorkLine';
import type { CommentRow } from './useCommentRow';
import type { ReviewEntry } from './useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
  readonly work: CommentWork | null;
  readonly result: CommentRowResult | null;
  readonly row: CommentRow;
  readonly onStopWork: (params: StopWorkParams) => void;
};

const STARTING_DETAIL = 'Starting the fix';

export const CommentRowWork = ({ sessionId, entry, work, result, row, onStopWork }: Props) => {
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  if (work !== null) {
    return <CommentWorkLine sessionId={sessionId} work={work} onStop={onStopWork} />;
  }
  if (result === null) {
    return row.isStarting ? <ItemWorkLine state="starting" detail={STARTING_DETAIL} /> : null;
  }
  const isReviewShown = isReviewOpen && result.action === 'reviewApply' && !row.isStarting;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ItemWorkLine
        state={row.isStarting ? 'starting' : result.state}
        detail={row.isStarting ? STARTING_DETAIL : result.detail}
        action={
          <CommentResultAction
            sessionId={sessionId}
            entry={entry}
            action={result.action}
            row={row}
            isReviewOpen={isReviewShown}
            onToggleReview={() => setIsReviewOpen((isOpen) => !isOpen)}
          />
        }
      />
      {isReviewShown ? <CommentFixReview sessionId={sessionId} entry={entry} row={row} /> : null}
    </div>
  );
};
