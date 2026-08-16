import { useEffect, useState } from 'react';

type Params = {
  readonly ms: number;
  readonly resetKey?: unknown;
};

export const useSettleElapsed = ({ ms, resetKey }: Params): boolean => {
  const [hasSettleElapsed, setHasSettleElapsed] = useState(false);

  useEffect(() => {
    setHasSettleElapsed(false);
    const timer = window.setTimeout(() => setHasSettleElapsed(true), ms);
    return () => window.clearTimeout(timer);
  }, [ms, resetKey]);

  return hasSettleElapsed;
};
