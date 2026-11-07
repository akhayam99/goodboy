import { Button } from '@goodboy/ui';
import { DeliveryActions } from '../../../../../shared/components/DeliveryActions';
import { SendStopControl } from '../../../../../shared/components/SendStopControl';
import { formatCombo, shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import { NAMES } from '../../../../../shared/utils/names';

type Props = {
  readonly isRunning: boolean;
  readonly canSend: boolean;
  readonly isDenying?: boolean;
  readonly sendDisabledTitle?: string;
  readonly onSend: () => void;
  readonly onSendNow: () => void;
};

export const SendControl = ({
  isRunning,
  canSend,
  isDenying = false,
  sendDisabledTitle,
  onSend,
  onSendNow,
}: Props) => {
  if (isRunning) {
    return canSend ? (
      <DeliveryActions
        canSend={canSend}
        readNowLabel="Send now"
        readNowHint="Stop and read this now"
        queueHint="Waits for the reply"
        queueKeys={formatCombo('Enter')}
        readNowKeys={shortcutGlyphs('composer.submit')}
        onQueue={onSend}
        onReadNow={onSendNow}
      />
    ) : null;
  }

  if (isDenying && canSend) {
    return (
      <Button variant="primary" size="sm" onClick={onSend}>
        {NAMES.sendAndDeny}
      </Button>
    );
  }

  return <SendStopControl canSend={canSend} disabledReason={sendDisabledTitle} onSend={onSend} />;
};
