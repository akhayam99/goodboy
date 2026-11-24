import type { ComponentType } from 'react';
import { HeroScene } from './HeroScene';

export const HERO_SCENES: Readonly<Record<string, ComponentType>> = {
  'hero-diff': HeroScene,
};
