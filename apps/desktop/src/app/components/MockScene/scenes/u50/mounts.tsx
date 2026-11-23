import type { ComponentType } from 'react';
import { MountFixScene } from './MountFixScene';
import { MountsPickerScene } from './MountsPickerScene';

export const U50_MOUNTS_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-mounts-picker-light': () => <MountsPickerScene theme="light" />,
  'u50-mounts-picker-dark': () => <MountsPickerScene theme="dark" />,
  'u50-mounts-unmount-light': () => <MountFixScene theme="light" isConfirmOpen />,
  'u50-mounts-unmount-dark': () => <MountFixScene theme="dark" isConfirmOpen />,
};
