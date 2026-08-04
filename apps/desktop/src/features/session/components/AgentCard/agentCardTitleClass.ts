import { cn } from '@goodboy/ui';
import type { AgentCardDensity } from './agentCardDensity';

const SIZE: Record<AgentCardDensity, string> = {
  lane: 'text-sm',
  sidebar: 'text-2xs',
};

const RESTING_COLOR: Record<AgentCardDensity, string> = {
  lane: 'text-foreground/80',
  sidebar: 'text-muted-foreground',
};

type Params = {
  readonly density: AgentCardDensity;
  readonly isSelected: boolean;
};

export const agentCardTitleClass = ({ density, isSelected }: Params): string =>
  cn(
    'min-w-0 flex-1 truncate text-left font-medium',
    SIZE[density],
    isSelected ? 'text-foreground' : RESTING_COLOR[density],
  );
