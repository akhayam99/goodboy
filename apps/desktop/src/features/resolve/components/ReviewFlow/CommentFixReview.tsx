import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ITEM_WORK_WORDS } from '../../../live-state/itemWork/itemWorkWords';
import { useResolveCandidateDiff } from '../../hooks/useResolveCandidateDiff';
import { ProposedChange } from './ProposedChange';
import { RowFixDiffLink } from './RowFixDiffLink';
import type { CommentRow } from './useCommentRow';
import type { ReviewEntry } from './useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
  readonly row: CommentRow;
};

const REVIEW_LABEL = 'Proposed fix';

export const CommentFixReview = ({ sessionId, entry, row }: Props) => {
  const diff = useResolveCandidateDiff({ candidate: row.candidate, row: entry.row });
  return (
    <section
      aria-label={REVIEW_LABEL}
      data-row-review=""
      className="flex min-w-0 flex-col gap-2 rounded-lg bg-subtle p-3"
    >
      <ProposedChange
        files={diff.files}
        isLoading={diff.isLoading}
        error={diff.error}
        isOffTarget={diff.isOffTarget}
        isCompact
      />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          isBusy={row.isApplying}
          disabled={row.isDiscarding}
          onClick={row.apply}
        >
          {ITEM_WORK_WORDS.verb.apply}
        </Button>
        <Button variant="ghost" size="sm" disabled={row.isApplying} onClick={row.retryWithHint}>
          {ITEM_WORK_WORDS.verb.retryWithHint}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          isBusy={row.isDiscarding}
          disabled={row.isApplying}
          onClick={row.discard}
        >
          {ITEM_WORK_WORDS.verb.discard}
        </Button>
        {entry.fix?.kind === 'fixed' ? (
          <RowFixDiffLink sessionId={sessionId} entry={entry} commit={entry.fix.commit} />
        ) : null}
      </div>
    </section>
  );
};
