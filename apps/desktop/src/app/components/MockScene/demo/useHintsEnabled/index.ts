import { useCallback, useState } from 'react';
import { readHintsEnabled } from '../hints/readHintsEnabled';
import { writeHintsEnabled } from '../hints/writeHintsEnabled';

type EnabledParams = {
  readonly isEnabled: boolean;
};

export type HintsEnabled = {
  readonly isEnabled: boolean;
  readonly setEnabled: (params: EnabledParams) => void;
};

const initial = (): boolean => readHintsEnabled({ isFallbackOn: true });

export const useHintsEnabled = (): HintsEnabled => {
  const [isEnabled, setIsEnabled] = useState(initial);

  const setEnabled = useCallback(({ isEnabled: isNext }: EnabledParams) => {
    writeHintsEnabled({ isEnabled: isNext });
    setIsEnabled(isNext);
  }, []);

  return { isEnabled, setEnabled };
};
