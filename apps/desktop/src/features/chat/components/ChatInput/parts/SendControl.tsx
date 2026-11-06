import { Button } from '@goodboy/ui';
import { DeliveryActions } from '../../../../../shared/components/DeliveryActions';
import { SendStopControl } from '../../../../../shared/components/SendStopControl';

import type { StopPhase } from '../../../../../shared/hooks/useAgentStop';
import { formatCombo, shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import { NAMES } from '../../../../../shared/utils/names';

type Props = {
  readonly isRunning: boolean;
  readonly canSend: boolean;
  readonly isDenying?: boolean;
  readonly sendDisabledTitle?: string;
  readonly onSend: () => void;
  readonly onSendNow: () => void;
  readonly stopPhase?: StopPhase;
  readonly isStopArmed?: boolean;
  readonly onStop?: () => void;
};

export const SendControl = ({
  isRunning,
  canSend,
  isDenying = false,
  sendDisabledTitle,
  onSend,
  onSendNow,
  stopPhase = 'idle',
  isStopArmed = false,
  onStop,
}: Props) => {
  if (isRunning) {
    return (
      <>
        {onStop === undefined ? null : (
          <SendStopControl
            canSend={canSend}
            stop={{
              isStopping: stopPhase === 'stopping',
              isStalled: stopPhase === 'stalled',
              isArmed: isStopArmed,
              shortcut: 'agent.stop',
              onStop,
            }}
            onSend={onSend}
          />
        )}
        <DeliveryActions
          canSend={canSend}
          readNowLabel="Send now"
          readNowHint="Stop the turn and read this now"
          queueKeys={formatCombo('Enter')}
          readNowKeys={shortcutGlyphs('composer.submit')}
          onQueue={onSend}
          onReadNow={onSendNow}
        />
      </>
    );
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
