import type { ComponentType } from 'react';
import { P23PresetPickerScene } from './P23PresetPickerScene';

export const U26_P23_SCENES: Readonly<Record<string, ComponentType>> = {
  'p23-preset-picker-dark': () => <P23PresetPickerScene theme="dark" />,
  'p23-preset-picker-light': () => <P23PresetPickerScene theme="light" />,
};
