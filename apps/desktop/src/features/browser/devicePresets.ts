import type { DevicePresetId } from '../../store/slices/browser/types';

export type DevicePreset = {
  readonly id: DevicePresetId;
  readonly label: string;
  readonly width: number | null;
};

type PresetParams = {
  readonly id: DevicePresetId;
};

type ValueParams = {
  readonly value: string;
};

const TABLET_WIDTH = 768;
const PHONE_WIDTH = 390;

export const DEFAULT_DEVICE_PRESET: DevicePresetId = 'desktop';
export const DEVICE_FRAME_INSET_PX = 9;
export const DEVICE_WIDTH_ONLY_NOTE = "Width only, the user agent didn't change";
export const DEVICE_WIDTH_PLATFORM_NOTE = "Width only on this platform. Touch isn't simulated.";

const DESKTOP_PRESET: DevicePreset = { id: 'desktop', label: 'Desktop', width: null };

export const DEVICE_PRESETS: ReadonlyArray<DevicePreset> = [
  DESKTOP_PRESET,
  { id: 'tablet', label: `Tablet ${TABLET_WIDTH}`, width: TABLET_WIDTH },
  { id: 'phone', label: `Phone ${PHONE_WIDTH}`, width: PHONE_WIDTH },
];

export const devicePresetOf = ({ id }: PresetParams): DevicePreset =>
  DEVICE_PRESETS.find((preset) => preset.id === id) ?? DESKTOP_PRESET;

export const devicePresetIdOf = ({ value }: ValueParams): DevicePresetId | null =>
  DEVICE_PRESETS.find((preset) => preset.id === value)?.id ?? null;

export const deviceNoteOf = ({ id }: PresetParams): string | null =>
  id === 'desktop' ? null : `${devicePresetOf({ id }).label}. Touch isn't simulated.`;
