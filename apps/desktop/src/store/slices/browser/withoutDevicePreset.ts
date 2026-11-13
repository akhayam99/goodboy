import type { BrowserState } from './state';

type Params = {
  readonly presets: BrowserState['browserDevicePresets'];
  readonly tabId: string;
};

export const withoutDevicePreset = ({ presets, tabId }: Params): Params['presets'] => {
  if (presets[tabId] === undefined) {
    return presets;
  }
  return Object.fromEntries(Object.entries(presets).filter(([id]) => id !== tabId));
};
