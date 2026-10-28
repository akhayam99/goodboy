import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button, IconButton, Notice } from '@goodboy/ui';
import type { ActionControls } from '../../useActionControls';

type Props = {
  readonly controls: ActionControls;
  readonly showReasons?: boolean;
  readonly failureActions?: ReactNode;
  readonly failureHint?: ReactNode;
  readonly failureDetail?: ReactNode;
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
  const failed =
    controls.failure === null
      ? null
      : (controls.actions.find((action) => action.id === controls.failure?.actionId) ?? null);
  if (reasons.length === 0 && controls.failure === null && controls.outcome === null) {
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
      {controls.outcome !== null && (
        <div role="status" className="flex min-w-0 items-center gap-1">
          <p className="min-w-0 text-right text-foreground">{controls.outcome.message}</p>
          <IconButton
            icon={X}
            label="Dismiss"
            size="xs"
            variant="ghost"
            onClick={controls.dismissOutcome}
          />
        </div>
      )}
      {controls.failure !== null && (
        <div className="flex w-full min-w-0 flex-col gap-2 self-stretch text-left">
          <Notice
            tone="danger"
            placement="inline"
            role="alert"
            title={
              failed !== null
                ? `${failed.label} failed`
                : controls.failure.actionId.endsWith('push')
                  ? 'Push failed'
                  : "Couldn't finish"
            }
            body={failureDetail ?? controls.failure.message}
            actions={
              <>
                {failureActions}
                <Button size="sm" variant="secondary" onClick={controls.retry}>
                  Retry
                </Button>
              </>
            }
          />
          {failureHint}
        </div>
      )}
    </div>
  );
};
