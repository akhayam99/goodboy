import { StateDot, type DotState } from '@goodboy/ui';
import type { WorkRowTone } from '../../workStateOf';

type Props = {
  readonly tone: WorkRowTone;
  readonly label: string;
  readonly isLive: boolean;
};

const DOT_STATE = {
  warning: 'needsYou',
  info: 'running',
  neutral: 'idle',
  success: 'done',
} as const satisfies Readonly<Record<WorkRowTone, DotState>>;

export const WorkRowDot = ({ tone, label, isLive }: Props) => (
  <span className="flex items-center justify-center">
    <StateDot state={DOT_STATE[tone]} label={label} isLive={isLive} />
  </span>
);
