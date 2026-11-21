import { useEffect, useState } from 'react';
import { msUntilMidnight } from '../../utils/time/msUntilMidnight';

export const useDayClock = (): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (): void => {
      timer = setTimeout(
        () => {
          setNow(Date.now());
          schedule();
        },
        msUntilMidnight({ now: Date.now() }),
      );
    };
    schedule();
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return now;
};
