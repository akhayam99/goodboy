import type { ComponentType } from 'react';
import { DeskMotionScene } from './DeskMotionScene';

export const U50_DESK_MOTION_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-desk-motion-dark': () => <DeskMotionScene theme="dark" />,
  'u50-desk-motion-light': () => <DeskMotionScene theme="light" />,
};
