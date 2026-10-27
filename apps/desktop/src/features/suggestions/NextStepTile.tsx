import type { LucideIcon } from 'lucide-react';
import { cn, ICON_SIZE, tintClasses, type Tone } from '@goodboy/ui';

import { agentKindPalette, type AgentKind } from '../session/agent-kind';
import { NEXT_STEP_CELLS } from './nextStepGrid';

type Props = {
  readonly agentKind: AgentKind | null;
  readonly fallbackIcon: LucideIcon;
  readonly tone: Tone;
};

export const NextStepTile = ({ agentKind, fallbackIcon: FallbackIcon, tone }: Props) => {
  if (agentKind === null) {
    return (
      <span
        aria-hidden
        data-column="tile"
        className={cn(NEXT_STEP_CELLS.tile, 'rounded-full bg-current/12', tintClasses(tone).icon)}
      >
        <FallbackIcon size={ICON_SIZE.control} />
      </span>
    );
  }
  const palette = agentKindPalette({ kind: agentKind });
  const Icon = palette.icon;
  return (
    <span
      aria-hidden
      data-column="tile"
      data-agent-kind={agentKind}
      className={cn(NEXT_STEP_CELLS.tile, 'rounded-full bg-current/12', palette.fg)}
    >
      <Icon size={ICON_SIZE.control} />
    </span>
  );
};
