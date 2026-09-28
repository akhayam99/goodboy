import { useMemo, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Chip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import { REVIEW_COUNT_NOUN, type ReviewCommentState } from '../../reviewCommentState';
import type { ReviewEntry } from './useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly noPullRequestLine: ReactNode;
};

const COUNT_ORDER: ReadonlyArray<ReviewCommentState> = [
  'needs',
  'failed',
  'outdated',
  'ready',
  'drafting',
  'new',
  'accepted',
  'replied',
  'skipped',
  'pushed',
];

const countsOf = (
  entries: ReadonlyArray<ReviewEntry>,
): ReadonlyArray<{ readonly noun: string; readonly count: number }> => {
  const byNoun = new Map<string, number>();
  for (const state of COUNT_ORDER) {
    const count = entries.filter(
      (entry) => entry.state === state || (state === 'ready' && entry.state === 'edited'),
    ).length;
    if (count > 0) {
      byNoun.set(REVIEW_COUNT_NOUN[state], count);
    }
  }
  return [...byNoun].map(([noun, count]) => ({ noun, count }));
};

export const ReviewHeaderMeta = ({ sessionId, entries, noPullRequestLine }: Props) => {
  const target = useMemo(() => ({ kind: 'review' as const, sessionId }), [sessionId]);
  const env = useActionEnv({ origin: 'button' });
  const { actions, run } = useObjectActions({ target, env });
  const link = actions.find((action) => action.slot === 'link') ?? null;
  const counts = countsOf(entries);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {link === null ? (
        noPullRequestLine
      ) : (
        <button
          type="button"
          onClick={() => void run({ actionId: link.id })}
          className="inline-flex w-fit items-center gap-1.5 rounded-sm text-secondary text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-safe:transition-colors"
        >
          <link.icon size={ICON_SIZE.row} aria-hidden />
          {link.label.replace(/^Open /, '')}
          <ChevronRight size={ICON_SIZE.row} aria-hidden />
        </button>
      )}
      {counts.length > 0 && (
        <ul aria-label="Comment states" className="flex flex-wrap items-center gap-1.5">
          {counts.map(({ noun, count }) => (
            <li key={noun} className="list-none">
              <Chip
                tone="neutral"
                size="xs"
                label={
                  <span className="tabular-nums">
                    <span className="text-foreground">{count}</span> {noun}
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
