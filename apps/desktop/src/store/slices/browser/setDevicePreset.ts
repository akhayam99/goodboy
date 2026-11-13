import type { SliceDeps } from '../../slice-types';
import type { DevicePresetParams } from './types';

export const setDevicePreset = ({ set }: SliceDeps) => {
  return ({ tabId, preset }: DevicePresetParams): void => {
    set((state) => {
      const rest = Object.fromEntries(
        Object.entries(state.browserDevicePresets).filter(([id]) => id !== tabId),
      );
      return {
        browserDevicePresets: preset === 'desktop' ? rest : { ...rest, [tabId]: preset },
      };
    });
  };
};
