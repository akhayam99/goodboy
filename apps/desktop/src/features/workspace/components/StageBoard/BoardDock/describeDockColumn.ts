import type { LucideIcon } from 'lucide-react';
import type { Tone } from '@goodboy/ui';
import { SESSION_STAGE_ICON, STAGE_TONE } from '../../../../session/session-stage';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import type { BoardCollapsibleColumn } from '../../../hooks/useBoardCollapse';

type Base = {
  readonly label: string;
  readonly tone: Tone;
  readonly icon: LucideIcon;
};

const BASE: Record<BoardCollapsibleColumn, Base> = {
  done: { label: 'Done', tone: STAGE_TONE.done, icon: SESSION_STAGE_ICON.done },
  archived: { label: 'Archived', tone: 'neutral', icon: CONCEPT_ICONS.archive },
};

type Params = {
  readonly column: BoardCollapsibleColumn;
  readonly count: number;
};

export type DockColumn = Base & {
  readonly ariaLabel: string;
  readonly countLabel: string;
};

export const describeDockColumn = ({ column, count }: Params): DockColumn => {
  const base = BASE[column];
  return {
    ...base,
    ariaLabel: `${base.label}, ${count} ${count === 1 ? 'session' : 'sessions'}`,
    countLabel: count > 99 ? '99+' : String(count),
  };
};
