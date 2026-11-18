import type { ComponentType } from 'react';
import { ItemWorkScene } from './ItemWorkScene';

export const U48_ITEM_WORK_SCENES = {
  'u48-item-work-line': () => <ItemWorkScene theme="dark" />,
  'u48-item-work-line-light': () => <ItemWorkScene theme="light" />,
} satisfies Readonly<Record<string, ComponentType>>;
