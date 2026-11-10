import type { ComponentType } from 'react';
import { FootScene } from './FootScene';

export const U39_FOOT_SCENES: Readonly<Record<string, ComponentType>> = {
  'u39-foot': () => <FootScene hasUpdate={false} />,
  'u39-foot-update': () => <FootScene hasUpdate />,
};
