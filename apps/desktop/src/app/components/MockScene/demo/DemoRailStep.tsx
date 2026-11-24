import { ActivityRow, WorkNode, type ActivityRowTone } from '@goodboy/ui';
import type { RailRow } from '../../../../features/workTreeModel/railGeometry';
import { SpawnedRailCell } from '../../../../features/session/components/SessionWorkspace/parts/TimelinePane/SpawnedRailCell';
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

const ROW_TONE = {
  done: 'quiet',
  current: 'live',
  todo: 'pending',
} as const satisfies Record<StepState, ActivityRowTone>;

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
    className="flex min-w-0"
  >
    <SpawnedRailCell
      rail={rail}
      width={railWidth}
      marker={
        <WorkNode
          look="quiet"
          state={NODE_STATE[state]}
          label={WORD[state]}
          mark={{ kind: 'dot' }}
          size="sm"
        />
      }
    />
    <ActivityRow density="feed" tone={ROW_TONE[state]} text={label} />
  </li>
);
