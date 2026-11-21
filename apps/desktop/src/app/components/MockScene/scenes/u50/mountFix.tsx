import type { ComponentType } from 'react';
import { MountFixScene } from './MountFixScene';

export const U50_MOUNT_FIX_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-mount-fix-light': () => <MountFixScene theme="light" isConfirmOpen={false} />,
  'u50-mount-fix-dark': () => <MountFixScene theme="dark" isConfirmOpen={false} />,
  'u50-mount-fix-confirm-light': () => <MountFixScene theme="light" isConfirmOpen />,
  'u50-mount-fix-confirm-dark': () => <MountFixScene theme="dark" isConfirmOpen />,
};
