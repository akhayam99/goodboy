import { MODE_COPY } from '../../permissions/modeCopy';
import { startLimitAmountsOf } from '../actions/startOptions';
import { START_STOPS_CHOICES, stopsOfAutoLevel } from '../actions/startStops';
import { startActionIdOf } from '../actions/phoneActionIds';
import { MAX_GOAL_LENGTH, startsLeftToday } from '../actions/startState';
import type { StartAccessChoice, StartKindChoice, StartOffer } from '../contract/projections';
import type { WorkspaceScope } from './workspaceScope';

const ACCESS_CHOICES: ReadonlyArray<StartAccessChoice> = [
  {
    access: 'readOnly',
    label: MODE_COPY.plan.label,
    promise: MODE_COPY.plan.promise,
  },
  {
    access: 'askFirst',
    label: MODE_COPY.default.label,
    promise: MODE_COPY.default.promise,
  },
  {
    access: 'editsAllowed',
    label: MODE_COPY.acceptEdits.label,
    promise: MODE_COPY.acceptEdits.promise,
  },
];

type Params = {
  readonly scope: WorkspaceScope;
  readonly now: number;
};

export const startOfferOf = ({ scope, now }: Params): StartOffer => {
  const kinds: ReadonlyArray<StartKindChoice> = [
    { startKind: 'lead', presetId: null, label: 'Lead', hasLimit: true, hasStops: true },
    ...scope.presets.map((preset): StartKindChoice => ({
      startKind: 'leadPlan',
      presetId: preset.id,
      label: `Lead · plan ${preset.name}`,
      hasLimit: true,
      hasStops: true,
    })),
    {
      startKind: 'agentScout',
      presetId: null,
      label: 'Agent · Scout',
      hasLimit: false,
      hasStops: false,
    },
  ];
  return {
    actionId: startActionIdOf({ workspaceId: scope.workspace.id }),
    isPermitted: true,
    projects: scope.projects,
    kinds,
    accessChoices: ACCESS_CHOICES,
    defaultAccess: 'askFirst',
    stopsChoices: START_STOPS_CHOICES,
    defaultStops: stopsOfAutoLevel({ level: scope.defaultLevel }),
    limitAmounts: startLimitAmountsOf({ defaultUsd: scope.defaultLimitUsd }),
    defaultLimitUsd: scope.defaultLimitUsd,
    maxGoalLength: MAX_GOAL_LENGTH,
    remainingToday: startsLeftToday({ now }),
  };
};
