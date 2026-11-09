import type { ReactNode } from 'react';
import type { ActionRun } from '../../../../store/slices/action-runs/types';
import type { ActionControls } from '../../useActionControls';
import { ActionRunLine } from './ActionRunLine';

type Props = {
  readonly controls: ActionControls;
  readonly showReasons?: boolean;
  readonly failureActions?: ReactNode;
  readonly failureHint?: ReactNode;
  readonly failureDetail?: ReactNode;
};

const failureTitleOf = ({ controls }: Pick<Props, 'controls'>): string => {
  const failure = controls.failure;
  if (failure === null) {
    return '';
  }
  const failed = controls.actions.find((action) => action.id === failure.actionId);
  if (failed !== undefined) {
    return `${failed.label} failed`;
  }
  return failure.actionId.endsWith('push') ? 'Push failed' : "Couldn't finish";
};

const runOf = ({
  controls,
}: Pick<Props, 'controls'>): Pick<ActionRun, 'phase' | 'message'> | null => {
  if (controls.failure !== null) {
    return { phase: 'failed', message: controls.failure.message };
  }
  if (controls.outcome !== null) {
    return { phase: 'done', message: controls.outcome.message };
  }
  return null;
};

export const ActionStatusLine = ({
  controls,
  showReasons = true,
  failureActions = null,
  failureHint = null,
  failureDetail = null,
}: Props) => {
  const visible = showReasons
    ? [...controls.inSlot({ slot: 'primary' }), ...controls.inSlot({ slot: 'secondary' })]
    : [];
  const reasons = [
    ...new Set(
      visible.flatMap((action) => (action.blockedReason === null ? [] : [action.blockedReason])),
    ),
  ].map((reason) => ({
    reason,
    actions: visible.filter((action) => action.blockedReason === reason),
  }));
  const run = runOf({ controls });
  if (reasons.length === 0 && run === null) {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-col items-end gap-1 text-meta">
      {reasons.map(({ reason, actions }) => (
        <p key={reason} className="min-w-0 text-right">
          <span className="text-foreground">
            {actions.map((action) => action.shortLabel).join(', ')}
          </span>{' '}
          <span className="text-muted-foreground">{reason}</span>
        </p>
      ))}
      <ActionRunLine
        run={run}
        failureTitle={failureTitleOf({ controls })}
        onRetry={controls.retry}
        onDismiss={run?.phase === 'failed' ? controls.dismissFailure : controls.dismissOutcome}
        failureActions={failureActions}
        failureHint={failureHint}
        failureDetail={failureDetail}
      />
    </div>
  );
};
