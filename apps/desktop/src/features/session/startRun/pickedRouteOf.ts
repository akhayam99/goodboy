import type { RunRouteCloseness, Workflow } from '@goodboy/types';
import type { StartShape } from '../../../store/slices/sessionDraft/state';
import { AGENT_KIND_META, type AgentKind } from '../agent-kind';
import { presetRouteOf, roleRouteOf, shapeRouteOf } from './routeChoiceOf';
import type { RunRouteResult } from './runRouteOf';
import { RUN_ROUTE_COPY } from './runRouteCopy';

type Params = {
  readonly shape: StartShape;
  readonly ask: string;
  readonly preset: Workflow | null;
  readonly closeness: RunRouteCloseness;
  readonly role: AgentKind;
};

const PICKED_ROW = 1;

export const pickedRouteOf = ({ shape, ask, preset, closeness, role }: Params): RunRouteResult => {
  const why = RUN_ROUTE_COPY.why.picked;
  if (shape === 'preset' && preset !== null) {
    return {
      route: presetRouteOf({ preset, closeness, row: PICKED_ROW, why }),
      ask,
      preset,
      role: null,
    };
  }
  if (shape === 'agent') {
    return {
      route: roleRouteOf({ role, label: AGENT_KIND_META[role].noun, row: PICKED_ROW, why }),
      ask,
      preset: null,
      role,
    };
  }
  return {
    route: shapeRouteOf({ shape: shape === 'autoAgent' ? 'lead' : 'plan', row: PICKED_ROW, why }),
    ask,
    preset: null,
    role: null,
  };
};
