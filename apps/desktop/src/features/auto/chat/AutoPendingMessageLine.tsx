import { Button } from '@goodboy/ui';
import type { PendingMessageAction, PendingMessageLine } from './pendingMessageOf';

type Props = {
  readonly line: PendingMessageLine;
  readonly onAction: (action: PendingMessageAction) => void;
};

const ACTION_LABEL: Readonly<Record<PendingMessageAction, string>> = {
  sendNow: 'Send now',
  raiseLimit: 'Change limit',
  retry: 'Retry',
};

export const AutoPendingMessageLine = ({ line, onAction }: Props) => {
  const action = line.action;
  return (
    <div
      data-auto-pending-message=""
      data-tone={line.tone}
      role="status"
      className="flex min-w-0 items-center justify-end gap-3 text-ui text-muted-foreground"
    >
      <p className="min-w-0">{line.text}</p>
      {action === null ? null : (
        <Button variant="quiet" size="xs" onClick={() => onAction(action)}>
          {ACTION_LABEL[action]}
        </Button>
      )}
    </div>
  );
};
