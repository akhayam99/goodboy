import { useEffect } from 'react';
import { startRunEventName } from '../../../../../features/session/startRun/startRunEventName';
import { C08_SESSION_ID } from '../u25/c08RunSeed';
import { C08RunScene } from '../u25/C08RunScene';
import { seedU44Runs } from './runsSeed';

const OPEN_DELAY_MS = 300;

type Props = {
  readonly startText: string | null;
};

export const U44RunsScene = ({ startText }: Props) => {
  useEffect(() => {
    if (startText === null) {
      return;
    }
    const timer = window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent(startRunEventName({ sessionId: C08_SESSION_ID }), {
          detail: { text: startText },
        }),
      );
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [startText]);

  return <C08RunScene state="working" selection="list" extra={seedU44Runs} />;
};
