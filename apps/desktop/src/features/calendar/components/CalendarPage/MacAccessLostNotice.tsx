import { useState } from 'react';
import type { CalendarAccessState } from '@goodboy/types';
import { Button, Notice, formatError } from '@goodboy/ui';
import { AccessRefusedNotice } from '../../connect/AccessRefusedNotice';
import { calendarCommands } from '../../connect/calendarCommands';

type Props = {
  readonly label: string;
  readonly onReconnected: () => Promise<void>;
};

export const MacAccessLostNotice = ({ label, onReconnected }: Props) => {
  const [isAsking, setIsAsking] = useState(false);
  const [refused, setRefused] = useState<Extract<
    CalendarAccessState,
    'denied' | 'restricted'
  > | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reconnect = async (): Promise<void> => {
    setIsAsking(true);
    setError(null);
    try {
      const access = await calendarCommands.requestAccess();
      if (access === 'granted') {
        setRefused(null);
        await onReconnected();
        return;
      }
      setRefused(access === 'restricted' ? 'restricted' : 'denied');
    } catch (failure) {
      setError(formatError(failure));
    } finally {
      setIsAsking(false);
    }
  };

  if (refused !== null) {
    return <AccessRefusedNotice access={refused} />;
  }
  return (
    <Notice
      tone="danger"
      placement="inline"
      role="alert"
      title={`Goodboy can't read ${label}`}
      body="Access is off, so your meetings are hidden. Reconnect to see them."
      detail={error}
      actions={
        <Button
          size="sm"
          variant="secondary"
          isBusy={isAsking}
          busyLabel="Asking"
          onClick={() => void reconnect()}
        >
          Reconnect
        </Button>
      }
    />
  );
};
