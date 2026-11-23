import type { ComponentType } from 'react';
import { FbFaceScene } from './FbFaceScene';

export const U50_FB_FACE_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-fb-face-overview-light': () => <FbFaceScene theme="light" tool={null} />,
  'u50-fb-face-overview-dark': () => <FbFaceScene theme="dark" tool={null} />,
  'u50-fb-face-split-light': () => <FbFaceScene theme="light" tool="terminal" />,
  'u50-fb-face-split-dark': () => <FbFaceScene theme="dark" tool="terminal" />,
};
