import { agentKindPalette, type AgentKind } from '../agent-kind';
import { roleRouteOf } from './routeChoiceOf';
import { RUN_ROUTE_COPY } from './runRouteCopy';
import type { RunRouteResult } from './runRouteOf';

type Params = {
  readonly text: string;
  readonly role: AgentKind;
};

export const roleRunOf = ({ text, role }: Params): RunRouteResult => ({
  route: roleRouteOf({
    role,
    label: agentKindPalette({ kind: role }).label,
    row: 1,
    why: RUN_ROUTE_COPY.why.picked,
  }),
  ask: text.trim(),
  preset: null,
  role,
});
