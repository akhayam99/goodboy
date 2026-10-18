import { useEffect, useState } from 'react';
import { CREDENTIAL_RECHECK_EVENT } from '../credentials';

export const useCredentialRecheck = (): number => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onRecheck = () => setTick((current) => current + 1);
    window.addEventListener(CREDENTIAL_RECHECK_EVENT, onRecheck);
    return () => window.removeEventListener(CREDENTIAL_RECHECK_EVENT, onRecheck);
  }, []);

  return tick;
};
