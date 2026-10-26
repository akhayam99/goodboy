import { WorkNode, cn } from '@goodboy/ui';
import type { RailRow } from '../../../../features/workTreeModel/railGeometry';
import { SpawnedRailCell } from '../../SpawnedPanel/SpawnedRailCell';
import { STEP_ROW_HEIGHT } from './demoRailOf';

export type StepState = 'done' | 'current' | 'todo';

type Props = {
  readonly label: string;
  readonly state: StepState;
  readonly rail: RailRow;
  readonly railWidth: number;
};

const NODE_STATE = {
  done: 'done',
  current: 'running',
  todo: 'queued',
} as const satisfies Record<StepState, 'done' | 'running' | 'queued'>;

const WORD = {
  done: 'done',
  current: 'now',
  todo: 'next',
} as const satisfies Record<StepState, string>;

export const DemoRailStep = ({ label, state, rail, railWidth }: Props) => (
  <li
    aria-current={state === 'current' ? 'step' : undefined}
    data-state={state}
    aria-label={`${label}, ${WORD[state]}`}
    style={{ height: STEP_ROW_HEIGHT }}
    className="flex min-w-0 items-center gap-2 pr-2 text-ui"
  >
    <SpawnedRailCell
      rail={rail}
      width={railWidth}
      marker={
        <WorkNode state={NODE_STATE[state]} label={WORD[state]} mark={{ kind: 'dot' }} size="sm" />
      }
    />
    <span
      className={cn(
        'min-w-0 truncate',
        state === 'current' ? 'text-foreground' : null,
        state === 'done' ? 'text-muted-foreground' : null,
        state === 'todo' ? 'text-faint-foreground' : null,
      )}
    >
      {label}
    </span>
  </li>
);
