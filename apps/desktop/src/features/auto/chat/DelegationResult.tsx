import type { ReactNode } from 'react';
import { Check, FileText, MessageSquare, X } from 'lucide-react';
import { Chip, ICON_SIZE, type Tone } from '@goodboy/ui';
import { OutcomeLine } from '../../chat/readingOrder/OutcomeLine';
import { ReadingNotes } from '../../chat/readingOrder/ReadingNotes';
import type { DelegationResultView } from './delegationResultOf';
import { DelegationResultChips } from './DelegationResultChips';
import { summaryNotesOf } from './summaryNotesOf';
import { countNoun } from '../../../shared/utils/countNoun';
import { NAMES } from '../../../shared/utils/names';

const SUMMARY_ITEM_KEY = 'delegation-summary';

type Props = {
  readonly result: DelegationResultView;
  readonly isRerunningChecks?: boolean;
  readonly onRerunChecks?: () => void;
  readonly isActingPublish?: boolean;
  readonly onRetryPublish?: () => void;
  readonly onPutBackPublish?: () => void;
};

type CountParams = {
  readonly count: number;
};

const filesLine = ({ count }: CountParams): string =>
  count === 1 ? '1 file changed' : `${count} files changed`;

type ToneParams = {
  readonly verdict: DelegationResultView['checksVerdict'];
};

const checksToneOf = ({ verdict }: ToneParams): Tone => {
  if (verdict === 'red') {
    return 'danger';
  }
  return verdict === 'green' ? 'success' : 'neutral';
};

type ActionChipParams = {
  readonly label: string;
  readonly isDisabled: boolean;
  readonly onClick: () => void;
};

const actionChip = ({ label, isDisabled, onClick }: ActionChipParams): ReactNode => (
  <Chip
    key={label}
    as="button"
    kind="reference"
    tone="neutral"
    label={label}
    disabled={isDisabled}
    onClick={onClick}
  />
);

const chipsOf = ({
  result,
  isRerunningChecks = false,
  onRerunChecks,
  isActingPublish = false,
  onRetryPublish,
  onPutBackPublish,
}: Props): ReadonlyArray<ReactNode> => {
  const chips: ReactNode[] = [];
  if (result.changedFileCount > 0) {
    chips.push(
      <Chip
        key="files"
        kind="reference"
        tone="neutral"
        icon={<FileText size={ICON_SIZE.control} aria-hidden />}
        label={filesLine({ count: result.changedFileCount })}
      />,
    );
  }
  if (result.checksText !== null) {
    chips.push(
      <span key="checks" role="status" className="inline-flex min-w-0">
        <Chip
          kind="reference"
          tone={checksToneOf({ verdict: result.checksVerdict })}
          label={<span className="min-w-0 truncate">{result.checksText}</span>}
          className="min-w-0 max-w-full"
        />
      </span>,
    );
  }
  result.checks
    .filter((check) => check.status === 'fail')
    .forEach((check) => {
      chips.push(
        <Chip
          key={`check-${check.name}`}
          kind="reference"
          tone="danger"
          icon={<X size={ICON_SIZE.control} aria-hidden />}
          label={<span className="min-w-0 truncate">{check.name}</span>}
          title={check.isClaimed ? 'claimed by the agent' : undefined}
          className="min-w-0 max-w-full"
        />,
      );
    });
  const passedCount = result.checks.filter((check) => check.status === 'pass').length;
  if (passedCount > 0 && result.checksText === null) {
    chips.push(
      <Chip
        key="passed"
        kind="reference"
        tone="success"
        icon={<Check size={ICON_SIZE.control} aria-hidden />}
        label={`${countNoun({ count: passedCount, one: 'check' })} passed`}
      />,
    );
  }
  if (result.canRerunChecks && onRerunChecks !== undefined) {
    chips.push(
      actionChip({
        label: isRerunningChecks ? 'Running checks' : 'Retry checks',
        isDisabled: isRerunningChecks,
        onClick: onRerunChecks,
      }),
    );
  }
  if (result.publish !== null) {
    chips.push(
      <span key="publish" role="status" className="inline-flex min-w-0">
        <Chip
          kind="reference"
          tone={result.publish.tone}
          label={<span className="min-w-0 truncate">{result.publish.text}</span>}
          className="min-w-0 max-w-full"
        />
      </span>,
    );
    if (result.publish.canRetry && onRetryPublish !== undefined) {
      chips.push(
        actionChip({
          label: NAMES.retryPush,
          isDisabled: isActingPublish,
          onClick: onRetryPublish,
        }),
      );
    }
    if (result.publish.canPutBack && onPutBackPublish !== undefined) {
      chips.push(
        actionChip({
          label: 'Put back',
          isDisabled: isActingPublish,
          onClick: onPutBackPublish,
        }),
      );
    }
  }
  result.questions.forEach((question) => {
    chips.push(
      <Chip
        key={`question-${question}`}
        kind="reference"
        tone="warning"
        icon={<MessageSquare size={ICON_SIZE.control} aria-hidden />}
        label={<span className="min-w-0 truncate">{question}</span>}
        title={question}
        className="min-w-0 max-w-full"
      />,
    );
  });
  return chips;
};

export const DelegationResult = ({
  result,
  isRerunningChecks = false,
  onRerunChecks,
  isActingPublish = false,
  onRetryPublish,
  onPutBackPublish,
}: Props) => {
  const notes = summaryNotesOf({
    summary: result.summary,
    key: SUMMARY_ITEM_KEY,
    isOpen: result.outcomeLine?.tone === 'danger',
  });
  const outcomeLine = result.outcomeLine;
  const isReasonShown = result.reasonText !== null && outcomeLine?.source !== 'facts';
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {outcomeLine === null ? null : (
        <OutcomeLine text={outcomeLine.text} tone={outcomeLine.tone} />
      )}
      {isReasonShown ? <p className="text-meta text-warning">{result.reasonText}</p> : null}
      {result.remoteText === null ? null : (
        <p className="text-meta text-warning">{result.remoteText}</p>
      )}
      <DelegationResultChips
        chips={chipsOf({
          result,
          isRerunningChecks,
          onRerunChecks,
          isActingPublish,
          onRetryPublish,
          onPutBackPublish,
        })}
      />
      {notes === null ? null : <ReadingNotes role={notes} />}
    </div>
  );
};
