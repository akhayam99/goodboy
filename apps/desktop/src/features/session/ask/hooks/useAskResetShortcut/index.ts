import { useEffect, useRef } from 'react';
import { registerShortcut } from '../../../../../shared/keyboard/dispatcher';
import { isFocusInsideAsk } from '../../isFocusInsideAsk';

type Params = {
  readonly onReset: () => void;
};

export const useAskResetShortcut = ({ onReset }: Params): void => {
  const resetRef = useRef(onReset);
  resetRef.current = onReset;

  useEffect(() => {
    return registerShortcut(
      'ask.reset',
      () => {
        if (!isFocusInsideAsk({})) {
          return false;
        }
        resetRef.current();
        return true;
      },
      { canDecline: true },
    );
  }, []);
};
