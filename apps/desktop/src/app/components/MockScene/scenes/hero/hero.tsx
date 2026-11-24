import type { ComponentType } from 'react';
import { HeroScene } from './HeroScene';

export const HERO_SCENES: Readonly<Record<string, ComponentType>> = {
  'hero-ask': () => <HeroScene pane="ask" />,
  'hero-diff': () => <HeroScene pane="diff" />,
  'hero-agents': () => <HeroScene pane="agents" />,
};
