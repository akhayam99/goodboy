import { Check } from 'lucide-react';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { Button, Notice, SplitButton } from '@goodboy/ui';
import type { HistoryPlanPrediction } from '@goodboy/types';
import type { HistoryRun, HistoryRunPhase } from '../../../../store/slices/history/types';
import { isHistoryRunActive } from '../../../../store/slices/history/isHistoryRunActive';
import { editPhrase, type HistoryEdit } from '../../historyPlan';

type Props = {
  readonly summary: string;
  readonly hasChanges: boolean;
  readonly prediction: HistoryPlanPrediction | null;
  readonly isPredicting: boolean;
  readonly conflictEdit: HistoryEdit | null;
  readonly run: HistoryRun | null;
  readonly hasUpstream: boolean;
  readonly originCount: number;
  readonly onApply: (shouldPush: boolean) => void;
  readonly onDiscard: () => void;
  readonly onRewriteWithAgent: () => void;
  readonly onUndoEdit: (() => void) | null;
  readonly onApplyRewritten: (shouldPush: boolean) => void;
};

const plural = ({ count, word }: { readonly count: number; readonly word: string }) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

const PHASE_LINE: Readonly<Partial<Record<HistoryRunPhase, string>>> = {
  predicting: 'Checking the plan…',
  trying: 'Trying the plan in a copy. Your branch is not touched until this passes.',
  waiting: 'An agent is writing here. Apply waits for it.',
  applying: 'Moving the branch. A backup of the old history stays here.',
  pushing: 'Pushing with lease…',
  rewriting: 'History rewriter is merging the conflict in a copy.',
};

export const HistoryDock = ({
  summary,
  hasChanges,
  prediction,
  isPredicting,
  conflictEdit,
  run,
  hasUpstream,
  originCount,
  onApply,
  onDiscard,
  onRewriteWithAgent,
  onUndoEdit,
  onApplyRewritten,
}: Props) => {
  const isBusy = run !== null && isHistoryRunActive({ phase: run.phase });
  const conflict = prediction?.steps.find((step) => step.outcome === 'conflict') ?? null;
  const outcomeLine =
    prediction === null || prediction.head === null
      ? null
      : prediction.isTreeEqual
        ? 'Same code, new history'
        : `Changes the code: ${plural({ count: prediction.changedFiles.length, word: 'file' })} differ${prediction.changedFiles.length === 1 ? 's' : ''}`;
  const checkLine =
    prediction !== null && !prediction.isSupported
      ? 'Conflicts are checked when you apply'
      : isPredicting
        ? 'Checking…'
        : conflict === null && prediction !== null
          ? 'No conflicts expected'
          : null;

  if (run !== null && run.phase === 'rewritten' && run.result !== null) {
    return (
      <Notice
        tone="success"
        placement="inline"
        title={
          run.result.byAgent
            ? `Rewritten by History rewriter · ${run.result.isTreeEqual ? 'same code, new history' : 'the code changes'}`
            : 'The plan replayed cleanly in the copy'
        }
        body={
          run.result.isTreeEqual
            ? 'Nothing moved yet. Apply it to move the branch.'
            : `${plural({ count: run.result.changedFiles.length, word: 'file' })} differ from the branch today: ${run.result.changedFiles.join(', ')}`
        }
        actions={
          <Button size="sm" variant="primary" onClick={() => onApplyRewritten(hasUpstream)}>
            {hasUpstream ? 'Apply and push' : 'Apply'}
          </Button>
        }
      />
    );
  }

  if (conflict !== null && !isBusy) {
    return (
      <Notice
        tone="warning"
        placement="inline"
        title={
          conflictEdit === null
            ? `Replaying ${conflict.sha.slice(0, 7)} will conflict`
            : `${editPhrase({ edit: conflictEdit })} will conflict`
        }
        body={`Both change ${conflict.files.join(', ')}. Replaying them in this order needs someone to merge the two edits.`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={onRewriteWithAgent}>
              Rewrite with an agent
            </Button>
            {onUndoEdit !== null ? (
              <Button size="sm" variant="ghost" onClick={onUndoEdit}>
                Undo the change
              </Button>
            ) : null}
          </div>
        }
      />
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5 text-label text-foreground">
          <CONCEPT_ICONS.history
            size={ICON_SIZE.row}
            aria-hidden
            className="shrink-0 text-faint-foreground"
          />
          <span className="truncate">
            {summary}
            {originCount > 0 && hasChanges
              ? ` · rewrites ${plural({ count: originCount, word: 'commit' })} on origin`
              : ''}
          </span>
        </span>
        {run !== null && isBusy ? (
          <span role="status" className="text-secondary text-muted-foreground">
            {run.phase === 'waiting' && run.holder !== null
              ? `${run.holder} is writing here. Apply waits for it.`
              : (PHASE_LINE[run.phase] ?? '')}
          </span>
        ) : run !== null && run.phase === 'stopped' && run.stop !== null ? (
          <span role="alert" className="text-secondary text-warning">
            {run.stop.message}
          </span>
        ) : (
          <span className="flex min-w-0 items-center gap-1.5 text-secondary text-muted-foreground">
            {outcomeLine !== null && hasChanges ? <span>{outcomeLine}</span> : null}
            {outcomeLine !== null && hasChanges && checkLine !== null ? (
              <span aria-hidden>·</span>
            ) : null}
            {checkLine !== null ? (
              <span className="inline-flex items-center gap-1">
                {checkLine === 'No conflicts expected' ? <Check size={11} aria-hidden /> : null}
                {checkLine}
              </span>
            ) : null}
          </span>
        )}
      </div>
      {run !== null && run.phase === 'stopped' && run.stop?.reason === 'conflict' ? (
        <Button size="sm" variant="ghost" onClick={onRewriteWithAgent}>
          Rewrite with an agent
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" disabled={!hasChanges || isBusy} onClick={onDiscard}>
        Discard plan
      </Button>
      {hasUpstream ? (
        <SplitButton
          menuLabel="More ways to apply"
          items={[
            {
              kind: 'item',
              key: 'apply-here',
              label: 'Apply here, push later',
              description: 'Rewrites the branch here and leaves origin as it is.',
              disabled: !hasChanges || isBusy || conflict !== null,
              onClick: () => onApply(false),
            },
          ]}
          primary={({ className }) => (
            <Button
              size="sm"
              variant="primary"
              className={className}
              disabled={!hasChanges || isBusy || conflict !== null}
              onClick={() => onApply(true)}
            >
              Apply and push
            </Button>
          )}
        />
      ) : (
        <Button
          size="sm"
          variant="primary"
          disabled={!hasChanges || isBusy || conflict !== null}
          onClick={() => onApply(false)}
        >
          Apply
        </Button>
      )}
    </div>
  );
};
