import type { ComponentType } from 'react';
import { HomePlaceScene } from './HomePlaceScene';

export const HOME_PLACE_SCENES = {
  'home-place': () => <HomePlaceScene theme="dark" />,
  'home-place-light': () => <HomePlaceScene theme="light" />,
} satisfies Readonly<Record<string, ComponentType>>;
