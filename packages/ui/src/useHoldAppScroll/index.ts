import { useCallback, useContext } from 'react';
import { HeaderRevealContext } from '../useHeaderReveal/headerRevealContext';

export const useHoldAppScroll = (): (() => void) => {
  const reveal = useContext(HeaderRevealContext);
  return useCallback(() => reveal?.holdAppScroll(), [reveal]);
};
