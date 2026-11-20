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
import { REVIEW_SOURCE_LABEL } from '@goodboy/core/review-source';
import type { PrReviewDraft, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ReviewTarget } from '../../../../store/slices/review-drafts/resolveReviewTarget';
import type { MountReview } from '../../mountReviewOf';
import { reviewTargetLabelOf } from '../../reviewTargetLabelOf';
import { eventMatches } from '../../../../shared/keyboard/dispatcher';
import { SHORTCUTS, shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { EMPTY_REVIEW_SUBMISSION } from '../../../../store/slices/review-drafts/reviewSubmission';
import type { PublishPrReviewVerdict } from '../../../../store/slices/review-drafts/types';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import { LineComment } from './LineComment';

type Props = {
  readonly sessionId: SessionId;
  readonly review: MountReview;
  readonly drafts: ReadonlyArray<PrReviewDraft>;
  readonly variant?: 'page' | 'panel';
};

const VERDICTS = [
  { value: 'comment', label: 'Comment' },
  { value: 'approve', label: 'Approve' },
  { value: 'request_changes', label: 'Request changes' },
] as const;

const WRITE_REVIEW_FORM_LABEL = 'Your review';
const NO_LINE_COMMENTS = 'No line comments yet. Click a line number in the diff.';
const TARGET_CHOICE_LABEL = 'Review goes to';

type TargetParams = {
  readonly target: ReviewTarget;
};

type ChooseParams = {
  readonly key: string;
};

type HintParams = {
  readonly target: ReviewTarget | null;
};

const targetKeyOf = ({ target }: TargetParams): string =>
  `${target.provider}|${target.repo}|${target.prNumber}`;

const oneReviewHintOf = ({ target }: HintParams): string | null =>
  target === null
    ? null
    : `${REVIEW_SOURCE_LABEL[target.provider]} shows it on ${reviewTargetLabelOf({ target })} as one review.`;

export const WriteReviewForm = ({ sessionId, review, drafts, variant = 'page' }: Props) => {
  const submission = useAppStore((s) => s.reviewSubmission[sessionId] ?? EMPTY_REVIEW_SUBMISSION);
  const setReviewSubmission = useAppStore((s) => s.setReviewSubmission);
  const target = useMemo(
    () => ({ kind: 'writeReview' as const, sessionId, draftId: null }),
    [sessionId],
  );
  const env = useActionEnv({ origin: 'button' });
  const { actions, run } = useObjectActions({ target, env });
  const [error, setError] = useState<string | null>(null);
  const choiceOptions = useMemo(
    () =>
      review.choices.map((choice) => ({
        value: targetKeyOf({ target: choice }),
        label: reviewTargetLabelOf({ target: choice }),
      })),
    [review.choices],
  );
  const onChoose = ({ key }: ChooseParams): void => {
    const chosenTarget = review.choices.find((choice) => targetKeyOf({ target: choice }) === key);
    if (chosenTarget !== undefined) {
      setReviewSubmission({ sessionId, patch: { chosenTarget } });
    }
  };
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
          meta={<span className="tabular-nums text-muted-foreground">{drafts.length}</span>}
        />
        {drafts.length === 0 ? (
          <p className="text-meta text-muted-foreground">{NO_LINE_COMMENTS}</p>
        ) : (
          <ul className="flex min-w-0 flex-col gap-2">
            {drafts.map((draft) => (
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
      {review.choices.length > 1 && review.target !== null ? (
        <div className="w-fit">
          <SegmentedTabs<string>
            size="sm"
            options={choiceOptions}
            value={targetKeyOf({ target: review.target })}
            onChange={(key) => onChoose({ key })}
            ariaLabel={TARGET_CHOICE_LABEL}
          />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-meta text-muted-foreground">
          {oneReviewHintOf({ target: review.target })}
        </span>
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
