import { useMemo } from 'react';
import { AlertCircle, Ellipsis, RefreshCw, SquareTerminal } from 'lucide-react';
import { Button, KeyHint } from '@goodboy/ui';
import type { ResolveAttempt, SessionId } from '@goodboy/types';
import { useTranscript } from '../../../../store/slices/transcripts/selectors';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { reduceTranscript } from '../../../chat/utils/transcript-items';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import type { ResolvedAction, ReviewCommentActionTarget } from '../../../actions/types';
import { FAILED_RUN_COPY, failedVerbOf } from '../../failedRunCopy';
import { FIX_RUN_THREAD_COPY, REPLY_NOTE_COPY } from '../../reviewFlowCopy';
import { lastRunStep } from '../../lastRunStep';
import type { ResolveRowState } from '../../resolveRowState';
import { DraftRoutingBody } from './DraftRoutingBody';

type Props = {
  readonly sessionId: SessionId;
  readonly target: ReviewCommentActionTarget;
  readonly attempt: ResolveAttempt | null;
  readonly rowState: ResolveRowState;
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly isHintOpen: boolean;
  readonly isModelOpen: boolean;
  readonly isBusy: boolean;
  readonly onTryAgain: () => void;
  readonly onStartOver: () => void;
  readonly onToggleModel: () => void;
  readonly onRun: (actionId: string) => void;
};

const KEPT_IN_MENU: ReadonlyArray<string> = [
  'reviewComment.reply',
  'reviewComment.skip',
  'reviewComment.transcript',
];

const RUN_ONLY_IN_MENU: ReadonlyArray<string> = [
  'reviewComment.anotherModel',
  'reviewComment.edit',
];

export const FailedRun = ({
  sessionId,
  target,
  attempt,
  rowState,
  actions,
  isHintOpen,
  isModelOpen,
  isBusy,
  onTryAgain,
  onStartOver,
  onToggleModel,
  onRun,
}: Props) => {
  const transcript = useTranscript(attempt?.agentId ?? null);
  const step = useMemo(() => lastRunStep({ items: reduceTranscript(transcript) }), [transcript]);
  const isRun = rowState.failedStep === 'run' || rowState.failedStep === null;
  const canRetryReply = actions.some((action) => action.id === 'reviewComment.postReplyNow');
  const canOpenTranscript = actions.some((action) => action.id === 'reviewComment.transcript');
  const sentence = rowState.sentence;
  const failedOn = attempt === null ? null : modelLabel(attempt.model);

  const omitted = actions
    .filter(
      (action) =>
        !KEPT_IN_MENU.includes(action.id) && !(isRun && RUN_ONLY_IN_MENU.includes(action.id)),
    )
    .map((action) => action.id);
  const menu = (
    <ObjectOverflowMenu
      target={target}
      label={FAILED_RUN_COPY.moreActions}
      omit={omitted}
      trigger={<Ellipsis size={ICON_SIZE.control} aria-hidden />}
    />
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-2 rounded-lg bg-subtle px-4 py-2 text-meta text-foreground">
        <p className="flex min-w-0 items-start gap-2">
          <AlertCircle
            size={ICON_SIZE.control}
            aria-hidden
            className="mt-0.5 shrink-0 text-danger"
          />
          {sentence}
        </p>
        {isRun && step !== null && (
          <p className="flex min-w-0 items-center gap-2 pl-6 text-muted-foreground">
            <SquareTerminal size={ICON_SIZE.control} aria-hidden className="shrink-0" />
            <span className="min-w-0 truncate font-mono">
              {step.command} · {step.result}
            </span>
            {canOpenTranscript && (
              <button
                type="button"
                onClick={() => onRun('reviewComment.transcript')}
                className="ml-auto shrink-0 rounded-sm text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {FAILED_RUN_COPY.openTranscript}
              </button>
            )}
          </p>
        )}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {isRun ? (
          <>
            {!isHintOpen && (
              <Button size="sm" variant="primary" isBusy={isBusy} onClick={onTryAgain}>
                <RefreshCw size={ICON_SIZE.control} aria-hidden />
                {FIX_RUN_THREAD_COPY.retry}
                <KeyHint keys={shortcutGlyphs('review.fix')} onTone />
              </Button>
            )}
            <Button size="sm" variant="ghost" isBusy={isBusy} onClick={onStartOver}>
              {FIX_RUN_THREAD_COPY.startOver}
            </Button>
          </>
        ) : (
          <>
            {rowState.action === 'open_github' && rowState.failedStep !== null && (
              <Button
                size="sm"
                variant="primary"
                isBusy={isBusy}
                onClick={() => onRun('reviewComment.openOnGithub')}
              >
                {failedVerbOf({ action: rowState.action })}
              </Button>
            )}
            {canRetryReply && (
              <Button
                size="sm"
                variant="primary"
                isBusy={isBusy}
                onClick={() => onRun('reviewComment.postReplyNow')}
              >
                {REPLY_NOTE_COPY.retry}
              </Button>
            )}
          </>
        )}
        {menu}
      </div>

      {isRun && <p className="text-meta text-faint-foreground">{FIX_RUN_THREAD_COPY.retryHint}</p>}

      {isRun && isModelOpen && (
        <section
          aria-label={FAILED_RUN_COPY.modelList}
          className="flex min-w-0 flex-col gap-1 rounded-lg bg-subtle py-2"
        >
          <p className="px-3 text-meta text-muted-foreground">
            {failedOn === null
              ? FAILED_RUN_COPY.modelList
              : `${failedOn} ${FAILED_RUN_COPY.usedAndFailed}`}
          </p>
          <DraftRoutingBody sessionId={sessionId} onClose={onToggleModel} />
        </section>
      )}
    </div>
  );
};
