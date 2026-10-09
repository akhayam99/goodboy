import { useMemo, useState, type KeyboardEvent } from 'react';
import {
  Button,
  SectionHeader,
  SegmentedTabs,
  Textarea,
  Tooltip,
  formatError,
  KeyHint,
} from '@goodboy/ui';
import type { PrReviewDraft, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { eventMatches } from '../../../../../shared/keyboard/dispatcher';
import { SHORTCUTS, shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import { isReportedError } from '../../../../../store/slices/notifications/reportedError';
import { EMPTY_REVIEW_SUBMISSION } from '../../../../../store/slices/review-drafts/reviewSubmission';
import type { PublishPrReviewVerdict } from '../../../../../store/slices/review-drafts/types';
import { useActionEnv } from '../../../../actions/useActionEnv';
import { useObjectActions } from '../../../../actions/useObjectActions';
import { LineComment } from './LineComment';

type Props = {
  readonly sessionId: SessionId;
  readonly variant?: 'page' | 'panel';
};

const VERDICTS = [
  { value: 'comment', label: 'Comment' },
  { value: 'approve', label: 'Approve' },
  { value: 'request_changes', label: 'Request changes' },
] as const;

const WRITE_REVIEW_FORM_LABEL = 'Your review';
const NO_LINE_COMMENTS = 'No line comments yet. Click a line number in the diff.';
const ONE_REVIEW_HINT = 'GitHub shows it as one review.';

export const WriteReviewForm = ({ sessionId, variant = 'page' }: Props) => {
  const drafts = useAppStore(
    (s) => s.reviewDrafts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<PrReviewDraft>),
  );
  const submission = useAppStore((s) => s.reviewSubmission[sessionId] ?? EMPTY_REVIEW_SUBMISSION);
  const setReviewSubmission = useAppStore((s) => s.setReviewSubmission);
  const target = useMemo(
    () => ({ kind: 'writeReview' as const, sessionId, draftId: null }),
    [sessionId],
  );
  const env = useActionEnv({ origin: 'button' });
  const { actions, run } = useObjectActions({ target, env });
  const [error, setError] = useState<string | null>(null);
  const open = useMemo(() => drafts.filter((draft) => draft.status === 'draft'), [drafts]);
  const submit = actions.find((action) => action.id === 'writeReview.submit') ?? null;

  const onSubmit = (): void => {
    if (submit === null || submit.blockedReason !== null) {
      return;
    }
    setError(null);
    void run({ actionId: submit.id }).catch((caught: unknown) => {
      if (!isReportedError(caught)) {
        setError(formatError(caught));
      }
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (eventMatches({ event: event.nativeEvent, entry: SHORTCUTS['composer.submit'] })) {
      event.preventDefault();
      onSubmit();
    }
  };

  const button =
    submit === null ? null : (
      <Button
        size="sm"
        variant="primary"
        disabled={submit.blockedReason !== null && !submission.isSubmitting}
        isBusy={submission.isSubmitting}
        onClick={onSubmit}
      >
        {submit.label}
        <KeyHint keys={shortcutGlyphs('composer.submit')} isOnTone />
      </Button>
    );

  return (
    <section
      aria-label={WRITE_REVIEW_FORM_LABEL}
      className={
        variant === 'panel'
          ? 'flex min-w-0 flex-col gap-4'
          : 'flex min-w-0 flex-col gap-8 pb-8 pt-10'
      }
    >
      <div className="flex min-w-0 flex-col gap-2">
        <SectionHeader
          label="Line comments"
          headingLevel={2}
          meta={<span className="tabular-nums text-muted-foreground">{open.length}</span>}
        />
        {open.length === 0 ? (
          <p className="text-meta text-muted-foreground">{NO_LINE_COMMENTS}</p>
        ) : (
          <ul className="flex min-w-0 flex-col gap-2">
            {open.map((draft) => (
              <LineComment key={draft.id} sessionId={sessionId} draft={draft} />
            ))}
          </ul>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <SectionHeader label="Verdict" headingLevel={2} />
        <div className="w-fit">
          <SegmentedTabs<PublishPrReviewVerdict>
            size="sm"
            options={VERDICTS}
            value={submission.verdict}
            onChange={(verdict) => setReviewSubmission({ sessionId, patch: { verdict } })}
            ariaLabel="Review verdict"
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <SectionHeader label="Summary" headingLevel={2} htmlFor={`review-summary-${sessionId}`} />
        <Textarea
          id={`review-summary-${sessionId}`}
          value={submission.summary}
          autoGrow
          minRows={3}
          maxRows={10}
          disabled={submission.isSubmitting}
          className="text-body"
          placeholder="What the author should read first (optional)"
          onChange={(event) =>
            setReviewSubmission({ sessionId, patch: { summary: event.target.value } })
          }
          onKeyDown={onKeyDown}
        />
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-meta text-muted-foreground">{ONE_REVIEW_HINT}</span>
        {button !== null && submit?.blockedReason != null && !submission.isSubmitting ? (
          <Tooltip content={submit.blockedReason} anchorClassName="inline-flex">
            {button}
          </Tooltip>
        ) : (
          button
        )}
      </div>
      {error !== null && (
        <p role="alert" className="text-right text-meta text-danger">
          {error}
        </p>
      )}
    </section>
  );
};
