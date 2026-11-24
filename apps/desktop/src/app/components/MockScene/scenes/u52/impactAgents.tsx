import type { ComponentType } from 'react';
import { ImpactAgentsScene } from './ImpactAgentsScene';

export const U52_IMPACT_AGENTS_SCENES: Readonly<Record<string, ComponentType>> = {
  'u52-impact-agents-dark': () => <ImpactAgentsScene theme="dark" isRowOpen={false} />,
  'u52-impact-agents-light': () => <ImpactAgentsScene theme="light" isRowOpen={false} />,
  'u52-impact-agents-open-dark': () => <ImpactAgentsScene theme="dark" isRowOpen />,
  'u52-impact-agents-open-light': () => <ImpactAgentsScene theme="light" isRowOpen />,
};
