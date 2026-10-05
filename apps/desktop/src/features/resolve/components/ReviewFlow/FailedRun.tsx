import { useMemo, useState } from 'react';
import { AlertCircle, Cpu, Ellipsis, Lightbulb, RefreshCw, SquareTerminal } from 'lucide-react';
import { Button, KbdPill } from '@goodboy/ui';
import type { ResolveAttempt, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useTranscript } from '../../../../store/slices/transcripts/selectors';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { reduceTranscript } from '../../../chat/utils/transcript-items';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import type { ResolvedAction, ReviewCommentActionTarget } from '../../../actions/types';
import { FAILED_RUN_COPY, failedVerbOf, tryAgainLabel } from '../../failedRunCopy';
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
  readonly isBusy: boolean;
  readonly onTryAgain: () => void;
  readonly onAddHint: () => void;
  readonly onRun: (actionId: string) => void;
};

const KEPT_IN_MENU: ReadonlyArray<string> = [
  'reviewComment.reply',
  'reviewComment.skip',
  'reviewComment.transcript',
];

export const FailedRun = ({
  sessionId,
  target,
  attempt,
  rowState,
  actions,
  isHintOpen,
  isBusy,
  onTryAgain,
  onAddHint,
  onRun,
}: Props) => {
  const [isModelOpen, setIsModelOpen] = useState(false);
  const transcript = useTranscript(attempt?.agentId ?? null);
  const pickedModel = useAppStore((s) => s.resolveQueueView[sessionId]?.lastRouting?.model ?? null);
  const step = useMemo(() => lastRunStep({ items: reduceTranscript(transcript) }), [transcript]);
  const isRun = rowState.failedStep === 'run' || rowState.failedStep === null;
  const canOpenTranscript = actions.some((action) => action.id === 'reviewComment.transcript');
  const sentence = rowState.sentence;
  const failedOn = attempt === null ? null : modelLabel(attempt.model);

  const omitted = actions
    .filter((action) => !KEPT_IN_MENU.includes(action.id))
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
                {tryAgainLabel({
                  modelName: pickedModel === null ? null : modelLabel(pickedModel),
                  hasHint: false,
                })}
                <KbdPill
                  aria-hidden
                  className="ml-1 h-4 min-w-4 border-on-tone/30 bg-on-tone/15 text-chip text-on-tone"
                >
                  {shortcutGlyphs('review.fix')}
                </KbdPill>
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              aria-expanded={isModelOpen}
              onClick={() => setIsModelOpen((current) => !current)}
            >
              <Cpu size={ICON_SIZE.control} aria-hidden />
              {FAILED_RUN_COPY.anotherModel}
            </Button>
            <Button size="sm" variant="ghost" aria-expanded={isHintOpen} onClick={onAddHint}>
              <Lightbulb size={ICON_SIZE.control} aria-hidden />
              {FAILED_RUN_COPY.addHint}
            </Button>
          </>
        ) : (
          rowState.action === 'open_github' &&
          rowState.failedStep !== null && (
            <Button
              size="sm"
              variant="primary"
              isBusy={isBusy}
              onClick={() => onRun('reviewComment.openOnGithub')}
            >
              {failedVerbOf({ action: rowState.action })}
            </Button>
          )
        )}
        {menu}
      </div>

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
          <DraftRoutingBody sessionId={sessionId} onClose={() => setIsModelOpen(false)} />
        </section>
      )}
    </div>
  );
};
