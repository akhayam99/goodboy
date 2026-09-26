import { ArrowUp, Square } from 'lucide-react';
import { Button, cn, KbdPill, Tooltip, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly isRunning: boolean;
  readonly isEmpty: boolean;
  readonly canSend: boolean;
  readonly showsDeliveryChoice: boolean;
  readonly sendDisabledTitle?: string;
  readonly onCancel: () => void;
  readonly onSend: () => void;
  readonly onSendNow: () => void;
};

export const SendControl = ({
  isRunning,
  isEmpty,
  canSend,
  showsDeliveryChoice,
  sendDisabledTitle,
  onCancel,
  onSend,
  onSendNow,
}: Props) => {
  if (isRunning && isEmpty) {
    return (
      <Tooltip content="Stop the turn">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel turn"
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-md text-danger transition-colors',
            tintClasses('danger').hoverBg,
          )}
        >
          <Square size={ICON_SIZE.control} aria-hidden fill="currentColor" />
        </button>
      </Tooltip>
    );
  }

  if (showsDeliveryChoice) {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={onSend}>
          Queue{' '}
          <KbdPill aria-hidden className="h-4 min-w-4 text-2xs">
            ↵
          </KbdPill>
        </Button>
        <Button variant="primary" size="sm" onClick={onSendNow}>
          Send now{' '}
          <KbdPill aria-hidden className="h-4 min-w-4 text-2xs">
            ⌘↵
          </KbdPill>
        </Button>
      </>
    );
  }

  return (
    <Tooltip content={sendDisabledTitle ?? 'Send (enter)'}>
      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        aria-label="Send message"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-on-tone shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
      >
        <ArrowUp size={ICON_SIZE.control} aria-hidden />
      </button>
    </Tooltip>
  );
};
