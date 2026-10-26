import { Check, MessageSquare, X } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import { RevealedMarkdown } from '../../chat/reveal/RevealedMarkdown';
import { splitArtifactText } from '../../chat/utils/split-artifact-blocks';
import type { DelegationResultView } from './delegationResultOf';

const SUMMARY_ITEM_KEY = 'delegation-summary';

type Props = {
  readonly result: DelegationResultView;
  readonly liveKey?: string;
  readonly isRerunningChecks?: boolean;
  readonly onRerunChecks?: () => void;
  readonly isActingPublish?: boolean;
  readonly onRetryPublish?: () => void;
  readonly onPutBackPublish?: () => void;
};

type PublishToneParams = {
  readonly state: NonNullable<DelegationResultView['publish']>['state'];
};

const publishToneOf = ({ state }: PublishToneParams): string => {
  if (state === 'failed') {
    return 'text-warning';
  }
  return state === 'pushed' ? 'text-success' : 'text-muted-foreground';
};

type CountParams = {
  readonly count: number;
};

type SummaryParams = {
  readonly summary: string | null;
};

const filesLine = ({ count }: CountParams): string =>
  count === 1 ? '1 file changed' : `${count} files changed`;

type ToneParams = {
  readonly verdict: DelegationResultView['checksVerdict'];
};

const checksToneOf = ({ verdict }: ToneParams): string => {
  if (verdict === 'red') {
    return 'text-danger';
  }
  return verdict === 'green' ? 'text-success' : 'text-muted-foreground';
};

const proseOf = ({ summary }: SummaryParams): string | null => {
  if (summary === null) {
    return null;
  }
  const prose = splitArtifactText({ text: summary })
    .segments.map((segment) => (segment.kind === 'prose' ? segment.text : ''))
    .join('')
    .trim();
  return prose.length > 0 ? prose : null;
};

export const DelegationResult = ({
  result,
  liveKey = '',
  isRerunningChecks = false,
  onRerunChecks,
  isActingPublish = false,
  onRetryPublish,
  onPutBackPublish,
}: Props) => {
  const summary = proseOf({ summary: result.summary });
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {summary === null ? null : (
        <RevealedMarkdown
          liveKey={liveKey}
          itemKey={SUMMARY_ITEM_KEY}
          text={summary}
          className="min-w-0 text-meta"
        />
      )}
      {result.reasonText === null ? null : (
        <p className="text-meta text-warning">{result.reasonText}</p>
      )}
      {result.remoteText === null ? null : (
        <p className="text-meta text-warning">{result.remoteText}</p>
      )}
      {result.changedFileCount === 0 ? null : (
        <p className="text-meta text-muted-foreground">
          {filesLine({ count: result.changedFileCount })}
        </p>
      )}
      {result.checksText === null ? null : (
        <div className="flex min-w-0 items-center gap-2">
          <p
            role="status"
            className={`min-w-0 text-meta ${checksToneOf({ verdict: result.checksVerdict })}`}
          >
            {result.checksText}
          </p>
          {result.canRerunChecks && onRerunChecks !== undefined ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={isRerunningChecks}
              onClick={onRerunChecks}
            >
              {isRerunningChecks ? 'Running checks' : 'Run checks again'}
            </Button>
          ) : null}
        </div>
      )}
      {result.publish === null ? null : (
        <div className="flex min-w-0 items-center gap-2">
          <p
            role="status"
            className={`min-w-0 text-meta ${publishToneOf({ state: result.publish.state })}`}
          >
            {result.publish.text}
          </p>
          {result.publish.canRetry && onRetryPublish !== undefined ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={isActingPublish}
              onClick={onRetryPublish}
            >
              Try the push again
            </Button>
          ) : null}
          {result.publish.canPutBack && onPutBackPublish !== undefined ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={isActingPublish}
              onClick={onPutBackPublish}
            >
              Put back
            </Button>
          ) : null}
        </div>
      )}
      {result.checks.length === 0 ? null : (
        <ul aria-label="Checks" className="flex min-w-0 flex-col gap-0.5">
          {result.checks.map((check) => (
            <li
              key={check.name}
              className="flex min-w-0 items-center gap-2 text-meta text-muted-foreground"
            >
              {check.status === 'fail' ? (
                <X size={ICON_SIZE.control} aria-hidden className="shrink-0 text-danger" />
              ) : (
                <Check
                  size={ICON_SIZE.control}
                  aria-hidden
                  className={
                    check.status === 'pass'
                      ? 'shrink-0 text-success'
                      : 'shrink-0 text-faint-foreground'
                  }
                />
              )}
              <span className="min-w-0 truncate">{check.name}</span>
              {check.isClaimed ? (
                <span className="shrink-0 text-meta text-faint-foreground">
                  claimed by the agent
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {result.questions.length === 0 ? null : (
        <ul aria-label="Open questions" className="flex min-w-0 flex-col gap-0.5">
          {result.questions.map((question) => (
            <li
              key={question}
              className="flex min-w-0 items-center gap-2 text-meta text-muted-foreground"
            >
              <MessageSquare size={ICON_SIZE.control} aria-hidden className="shrink-0" />
              <span className="min-w-0">{question}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
