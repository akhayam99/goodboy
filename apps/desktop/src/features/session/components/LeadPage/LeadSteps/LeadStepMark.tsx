import { StateDot, type DotState } from '@goodboy/ui';
import type { StepState } from './stepLinesOf';

type Props = {
  readonly state: StepState;
};

type Face = Readonly<{
  dot: DotState;
  label: string;
}>;

const FACES = {
  done: { dot: 'done', label: 'Done' },
  running: { dot: 'running', label: 'Running' },
  attention: { dot: 'needsYou', label: 'Needs you' },
  skipped: { dot: 'stopped', label: 'Skipped' },
  queued: { dot: 'idle', label: 'Not started' },
  added: { dot: 'idle', label: 'Added' },
} as const satisfies Readonly<Record<StepState, Face>>;

export const LeadStepMark = ({ state }: Props) => (
  <StateDot state={FACES[state].dot} label={FACES[state].label} isLive={state === 'running'} />
);
