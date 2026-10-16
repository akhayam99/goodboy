import { useCallback, useState } from 'react';

type HeaderCloseClaim = {
  readonly isClaimed: boolean;
  readonly claim: () => () => void;
};

export const useHeaderCloseClaim = (): HeaderCloseClaim => {
  const [claims, setClaims] = useState(0);
  const claim = useCallback(() => {
    setClaims((count) => count + 1);
    return () => setClaims((count) => count - 1);
  }, []);
  return { isClaimed: claims > 0, claim };
};
