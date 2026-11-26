import type { AutoLevel } from '@goodboy/core/auto';
import { RUN_AUTONOMY_OPTIONS } from '../../workflows/runAutonomy';
import type { StartStopsChoice } from '../contract/projections';
import type { StartKind, StartStops } from '../contract/vocabulary';

export const AUTO_LEVEL_OF_STOPS = {
  everyStep: 'step',
  afterPlan: 'plan',
  never: 'run',
} as const satisfies Record<StartStops, AutoLevel>;

const STOPS_OF_AUTO_LEVEL = {
  step: 'everyStep',
  plan: 'afterPlan',
  run: 'never',
} as const satisfies Record<AutoLevel, StartStops>;

type KindParams = {
  readonly startKind: StartKind;
};

export const hasStopsOf = ({ startKind }: KindParams): boolean => startKind !== 'agentScout';

type LevelParams = {
  readonly level: AutoLevel;
};

export const stopsOfAutoLevel = ({ level }: LevelParams): StartStops => STOPS_OF_AUTO_LEVEL[level];

export const START_STOPS_CHOICES: ReadonlyArray<StartStopsChoice> = RUN_AUTONOMY_OPTIONS.map(
  (option): StartStopsChoice => ({
    stops: STOPS_OF_AUTO_LEVEL[option.key],
    label: option.label,
    promise: option.hint,
  }),
);
