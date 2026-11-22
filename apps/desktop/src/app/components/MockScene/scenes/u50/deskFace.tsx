import type { ComponentType } from 'react';
import { DeskFaceScene } from './DeskFaceScene';

export const U50_DESK_FACE_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-desk-face-light': () => <DeskFaceScene theme="light" face="desk" />,
  'u50-desk-face-dark': () => <DeskFaceScene theme="dark" face="desk" />,
  'u50-desk-face-overview-light': () => <DeskFaceScene theme="light" face="overview" />,
  'u50-desk-face-overview-dark': () => <DeskFaceScene theme="dark" face="overview" />,
};
