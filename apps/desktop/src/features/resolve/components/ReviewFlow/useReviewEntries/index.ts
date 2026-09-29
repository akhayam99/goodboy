import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { ResolveItemDraft } from '../../../resolveItemDraft';
import type { ResolveQueueRow } from '../../../buildResolveQueueRows';
import { groupConversationsByFile } from '../../../groupConversationsByFile';
import { useResolveQueueRows } from '../../../hooks/useResolveQueueRows';
import { useActiveReviewSource } from '../../../hooks/useActiveReviewSource';
import { rowBelongsToSource } from '../../../../../store/slices/review-source/rowBelongsToSource';
import { isReplyEdited } from '../../../reviewRows';
import {
  REVIEW_COMMENT_GROUPS,
  reviewCommentGroup,
  reviewCommentStateOf,
  reviewCommentWord,
  type ReviewCommentGroup,
  type ReviewCommentState,
} from '../../../reviewCommentState';

export type ReviewEntry = {
  readonly row: ResolveQueueRow;
  readonly threadId: string;
  readonly state: ReviewCommentState;
  readonly word: string;
  readonly group: ReviewCommentGroup;
};

export type ReviewGroup = {
  readonly group: ReviewCommentGroup;
  readonly entries: ReadonlyArray<ReviewEntry>;
};

const EMPTY_DRAFTS: Readonly<Record<string, ResolveItemDraft>> = {};

export const useReviewEntries = ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): {
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly groups: ReadonlyArray<ReviewGroup>;
} => {
  const rows = useResolveQueueRows({ sessionId });
  const { selected } = useActiveReviewSource({ sessionId });
  const { kind, projectId, number } = selected;
  const drafts = useAppStore((s) => s.resolveItemDrafts[sessionId] ?? EMPTY_DRAFTS);
  return useMemo(() => {
    const shown = rows.filter((row) =>
      rowBelongsToSource({ row: row.thread, entry: { kind, projectId, number } }),
    );
    const ordered = groupConversationsByFile({ rows: shown }).flatMap((group) => group.rows);
    const entries = ordered.map((row): ReviewEntry => {
      const state = reviewCommentStateOf({
        row,
        isEdited: isReplyEdited({ draft: drafts[row.thread.threadId], row }),
      });
      return {
        row,
        threadId: row.thread.threadId,
        state,
        word: reviewCommentWord({ state, row }),
        group: reviewCommentGroup({ state }),
      };
    });
    const groups = REVIEW_COMMENT_GROUPS.map((group) => ({
      group,
      entries: entries.filter((entry) => entry.group === group),
    })).filter((group) => group.entries.length > 0);
    return { entries: groups.flatMap((group) => group.entries), groups };
  }, [drafts, kind, number, projectId, rows]);
};
