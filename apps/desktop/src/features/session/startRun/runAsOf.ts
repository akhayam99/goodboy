import type { RunRouteCloseness } from '@goodboy/types';
import { agentKindPalette, type AgentKind } from '../agent-kind';
import { presetRouteOf, roleRouteOf, shapeRouteOf } from './routeChoiceOf';
import { RUN_ROUTE_COPY } from './runRouteCopy';
import { runRouteOf, type RunRouteFacts, type RunRouteResult } from './runRouteOf';

export type RunAs =
  | Readonly<{ kind: 'auto' }>
  | Readonly<{ kind: 'autoAgent' }>
  | Readonly<{ kind: 'orchestrated' }>
  | Readonly<{ kind: 'preset'; presetId: string; closeness?: RunRouteCloseness }>
  | Readonly<{ kind: 'role'; role: AgentKind }>;

export const AUTO_RUN_AS: RunAs = { kind: 'auto' };

type Params = {
  readonly runAs: RunAs;
  readonly facts: RunRouteFacts;
};

export const runAsRouteOf = ({ runAs, facts }: Params): RunRouteResult => {
  const typed = runRouteOf({ facts });
  if (runAs.kind === 'auto' || typed.route.why === RUN_ROUTE_COPY.why.picked) {
    return typed;
  }
  const ask = facts.text.trim();
  const why = RUN_ROUTE_COPY.why.picked;
  if (runAs.kind === 'autoAgent' || runAs.kind === 'orchestrated') {
    return {
      route: shapeRouteOf({
        shape: runAs.kind === 'autoAgent' ? 'lead' : 'plan',
        row: 1,
        why,
      }),
      ask,
      preset: null,
      role: null,
    };
  }
  if (runAs.kind === 'preset') {
    const preset = facts.presets.find((entry) => entry.id === runAs.presetId);
    if (preset === undefined) {
      return typed;
    }
    return {
      route: presetRouteOf({ preset, closeness: runAs.closeness ?? 'follow', row: 1, why }),
      ask,
      preset,
      role: null,
    };
  }
  return {
    route: roleRouteOf({
      role: runAs.role,
      label: agentKindPalette({ kind: runAs.role }).label,
      row: 1,
      why,
    }),
    ask,
    preset: null,
    role: runAs.role,
  };
};
