import type { ComponentType } from 'react';
import { AgentsTreeScene } from '../u27/AgentsTreeScene';
import { FOLD_SEED } from './agentsFoldSeed';

export const U30_AGENTS_FOLD_SCENES = {
  'u30-agents-fold': () => (
    <AgentsTreeScene theme="dark" isFocused={false} seed={FOLD_SEED} isShotFrame />
  ),
} satisfies Readonly<Record<string, ComponentType>>;
