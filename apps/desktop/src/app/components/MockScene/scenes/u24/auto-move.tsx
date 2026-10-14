import type { ComponentType } from 'react';
import { AutoMoveScene } from './AutoMoveScene';

export const U24_AUTO_MOVE_SCENES: Readonly<Record<string, ComponentType>> = {
  'auto-move-panel': () => <AutoMoveScene state="panel" />,
  'auto-move-moved': () => <AutoMoveScene state="moved" />,
};
