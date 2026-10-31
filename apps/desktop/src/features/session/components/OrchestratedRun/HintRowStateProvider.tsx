import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  HintRowStateContext,
  type HintFocusMark,
  type HintRowStateValue,
  type HintRowViewState,
} from './HintRowStateContext';

type Props = {
  readonly children: ReactNode;
};

export const HintRowStateProvider = ({ children }: Props) => {
  const [rows, setRows] = useState<Readonly<Record<string, HintRowViewState>>>({});
  const focusMark = useRef<HintFocusMark | null>(null);
  const value = useMemo<HintRowStateValue>(
    () => ({
      rows,
      focusMark,
      patch: ({ key, patch }) =>
        setRows((current) => ({
          ...current,
          [key]: { isExpanded: false, openImageId: null, ...current[key], ...patch },
        })),
    }),
    [rows],
  );
  return <HintRowStateContext.Provider value={value}>{children}</HintRowStateContext.Provider>;
};
