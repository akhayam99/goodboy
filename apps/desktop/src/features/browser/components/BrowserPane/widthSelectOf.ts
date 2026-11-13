import type { DevicePresetId } from '../../../../store/slices/browser/types';
import { devicePresetIdOf } from '../../devicePresets';

type PresetParams = {
  readonly preset: DevicePresetId;
};

type Params = {
  readonly onChoose: (params: PresetParams) => void;
};

export const widthSelectOf =
  ({ onChoose }: Params) =>
  (choice: string | null): void => {
    const preset = devicePresetIdOf({ value: choice ?? '' });
    if (preset !== null) {
      onChoose({ preset });
    }
  };
