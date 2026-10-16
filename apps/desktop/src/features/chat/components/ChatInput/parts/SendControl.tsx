import { ArrowUp } from 'lucide-react';
import { Tooltip } from '@goodboy/ui';
import { DeliveryActions } from '../../../../../shared/components/DeliveryActions';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { formatCombo, shortcutGlyphs } from '../../../../../shared/keyboard/registry';

type Props = {
  readonly isRunning: boolean;
  readonly canSend: boolean;
  readonly sendDisabledTitle?: string;
  readonly onSend: () => void;
  readonly onSendNow: () => void;
};

export const SendControl = ({
  isRunning,
  canSend,
  sendDisabledTitle,
  onSend,
  onSendNow,
}: Props) => {
  if (isRunning) {
    return (
      <DeliveryActions
        canSend={canSend}
        readNowLabel="Send now"
        readNowHint="Stop the turn and read this now"
        queueKeys={formatCombo('Enter')}
        readNowKeys={shortcutGlyphs('composer.submit')}
        onQueue={onSend}
        onReadNow={onSendNow}
      />
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
