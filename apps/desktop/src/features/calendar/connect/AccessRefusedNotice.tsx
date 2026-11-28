import { useState } from 'react';
import type { CalendarAccessState } from '@goodboy/types';
import { Button, Notice, formatError } from '@goodboy/ui';
import { calendarCommands } from './calendarCommands';

type Props = {
  readonly access: Extract<CalendarAccessState, 'denied' | 'restricted'>;
};

export const AccessRefusedNotice = ({ access }: Props) => {
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openSettings = async (): Promise<void> => {
    setIsOpening(true);
    setError(null);
    try {
      await calendarCommands.openPrivacySettings();
    } catch (failure) {
      setError(formatError(failure));
    } finally {
      setIsOpening(false);
    }
  };

  if (access === 'restricted') {
    return (
      <Notice
        tone="danger"
        placement="inline"
        role="alert"
        title="Calendar access is blocked on this Mac."
        body="A device profile blocks it. Connect a calendar link instead."
      />
    );
  }
  return (
    <Notice
      tone="danger"
      placement="inline"
      role="alert"
      title="macOS kept calendar access off."
      body="Turn on Goodboy in System Settings, Privacy and Security, Calendars. Then connect again."
      detail={error}
      actions={
        <Button
          size="sm"
          variant="secondary"
          isBusy={isOpening}
          busyLabel="Opening"
          onClick={() => void openSettings()}
        >
          Open System Settings
        </Button>
      }
    />
  );
};
