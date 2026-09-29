import { useMemo, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import { useActiveReviewSource } from '../../hooks/useActiveReviewSource';
import { reviewSummaryLine } from '../../reviewCommentState';
import { ReviewSourcePicker } from './ReviewSourcePicker';
import type { ReviewEntry } from './useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly noPullRequestLine: ReactNode;
};

export const ReviewHeaderMeta = ({ sessionId, entries, noPullRequestLine }: Props) => {
  const target = useMemo(() => ({ kind: 'review' as const, sessionId }), [sessionId]);
  const env = useActionEnv({ origin: 'button' });
  const { actions, run } = useObjectActions({ target, env });
  const selectReviewSource = useAppStore((s) => s.selectReviewSource);
  const { entries: sources, selected } = useActiveReviewSource({ sessionId });
  const link = actions.find((action) => action.slot === 'link') ?? null;
  const summary = reviewSummaryLine({ states: entries.map((entry) => entry.state) });
  const hasRemote = sources.some((source) => source.kind !== 'local');
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {hasRemote ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <ReviewSourcePicker
            entries={sources}
            selected={selected}
            onSelect={(key) => void selectReviewSource({ sessionId, key })}
          />
          {link !== null && (
            <button
              type="button"
              onClick={() => void run({ actionId: link.id })}
              aria-label={link.label
                .replace(/^Open PR/, 'Open pull request')
                .replace(/^Open MR/, 'Open merge request')}
              className="inline-flex w-fit items-center gap-1 rounded-sm text-secondary text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-safe:transition-colors"
            >
              {selected.kind === 'gitlab' ? 'Merge request' : 'Pull request'}
              <ChevronRight size={ICON_SIZE.row} aria-hidden />
            </button>
          )}
        </div>
      ) : (
        noPullRequestLine
      )}
      {summary.length > 0 && (
        <p
          aria-label="Comment summary"
          className="text-secondary tabular-nums text-muted-foreground"
        >
          {summary.map(({ count, noun }, index) => (
            <span key={noun}>
              {index > 0 && <span aria-hidden> · </span>}
              <span className="text-foreground">{count}</span> {noun}
            </span>
          ))}
        </p>
      )}
    </div>
  );
};
