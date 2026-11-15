import { createContext } from 'react';

type SettingRowFocus = {
  readonly row: string | null;
  readonly onShown: () => void;
};

export const SettingRowFocusContext = createContext<SettingRowFocus>({
  row: null,
  onShown: () => undefined,
});
