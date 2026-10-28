import type { StartShape } from '../../../store/slices/sessionDraft/state';
import type { AgentKind } from '../agent-kind';
import type { RunRouteResult } from './runRouteOf';

export type RunModelSlot =
  Readonly<{ kind: 'orchestrator' }> | Readonly<{ kind: 'agent'; agentKind: AgentKind }>;

type ResultParams = {
  readonly result: RunRouteResult;
};

type ShapeParams = {
  readonly shape: StartShape;
  readonly agentKind: AgentKind;
};

type KeyParams = {
  readonly slot: RunModelSlot;
};

export const ORCHESTRATOR_SLOT: RunModelSlot = { kind: 'orchestrator' };

export const AUTO_AGENT_SLOT: RunModelSlot = { kind: 'agent', agentKind: 'auto' };

export const runModelSlotOf = ({ result }: ResultParams): RunModelSlot => {
  if (result.route.shape === 'plan') {
    return ORCHESTRATOR_SLOT;
  }
  return result.role === null ? AUTO_AGENT_SLOT : { kind: 'agent', agentKind: result.role };
};

export const runModelSlotOfShape = ({ shape, agentKind }: ShapeParams): RunModelSlot => {
  if (shape === 'orchestrated' || shape === 'preset') {
    return ORCHESTRATOR_SLOT;
  }
  return shape === 'autoAgent' ? AUTO_AGENT_SLOT : { kind: 'agent', agentKind };
};

export const runModelSlotKeyOf = ({ slot }: KeyParams): string =>
  slot.kind === 'orchestrator' ? 'orchestrator' : `agent:${slot.agentKind}`;
