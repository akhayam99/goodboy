import { parseAutoDelegationRole } from '@goodboy/core';
import type { AutoDelegation } from '@goodboy/db';
import type { Agent, AgentId } from '@goodboy/types';
import { modelLineOf, type ModelLine } from '../../providers/modelLine/modelLineOf';
import { AGENT_KIND_META, kindForRole, type AgentKind } from '../../session/agent-kind';
import { delegationResultOf, type DelegationResultView } from './delegationResultOf';
import { recordField, textField } from './readJson';
import { settledStatusOf, type DelegationStatus } from './settledStatusOf';

export type DelegationCardModel = Readonly<{
  delegationId: string;
  childAgentId: AgentId;
  role: AgentKind;
  roleLabel: string;
  provider: string | null;
  model: string | null;
  effort: string | null;
  modelLine: ModelLine | null;
  task: string | null;
  reason: string | null;
  routingNote: string | null;
  status: DelegationStatus;
  isRevision: boolean;
  reviseVersion: number | null;
  isOpen: boolean;
  result: DelegationResultView | null;
}>;

type StatusParams = {
  readonly delegation: AutoDelegation;
};

const delegationStatusOf = ({ delegation }: StatusParams): DelegationStatus => {
  if (delegation.isStopping && delegation.state !== 'settled') {
    return { word: 'Stopping', tone: 'neutral', isLive: true };
  }
  switch (delegation.state) {
    case 'accepted':
      return { word: 'Queued', tone: 'neutral', isLive: false };
    case 'awaiting_confirm':
      return { word: 'Needs you', tone: 'warning', isLive: false, node: 'approval' };
    case 'starting':
      return { word: 'Starting', tone: 'info', isLive: true };
    case 'running':
      return { word: 'Running', tone: 'info', isLive: true };
    case 'paused':
      return { word: 'Needs you', tone: 'warning', isLive: false, node: 'question' };
    case 'settled':
      return settledStatusOf({ outcome: delegation.outcome ?? 'failed' });
    default: {
      const exhaustive: never = delegation.state;
      return exhaustive;
    }
  }
};

type NoteParams = {
  readonly routing: unknown;
  readonly modelLine: ModelLine | null;
};

const routingNoteOf = ({ routing, modelLine }: NoteParams): string | null => {
  const proposal = textField({ source: routing, key: 'proposal' });
  if (proposal !== 'adjusted' && proposal !== 'replaced') {
    return null;
  }
  const requestedRouting = recordField({ source: routing, key: 'requested' });
  const requested = modelLineOf({
    provider: textField({ source: requestedRouting, key: 'provider' }),
    model: textField({ source: requestedRouting, key: 'model' }),
    effort: null,
  });
  const why = textField({ source: routing, key: 'reason' });
  const asked =
    requested === null ? 'Auto asked for another model' : `Auto asked for ${requested.name}`;
  const used = modelLine === null ? 'the app chose' : `used ${modelLine.name}`;
  return why === null ? `${asked}, ${used}.` : `${asked}, ${used}: ${why}`;
};

type Params = {
  readonly delegation: AutoDelegation;
  readonly childAgent: Agent | null;
};

export const delegationCardOf = ({ delegation, childAgent }: Params): DelegationCardModel => {
  const role = parseAutoDelegationRole({ role: delegation.role });
  const kind: AgentKind = role === null ? 'generic' : kindForRole({ role });
  const provider = textField({ source: delegation.routing, key: 'provider' });
  const model = textField({ source: delegation.routing, key: 'model' });
  const effort = textField({ source: delegation.routing, key: 'effort' });
  const modelLine = modelLineOf({ provider, model, effort });
  const status = delegationStatusOf({ delegation });
  return {
    delegationId: delegation.id,
    childAgentId: delegation.childAgentId,
    role: kind,
    roleLabel: AGENT_KIND_META[kind].noun,
    provider,
    model,
    effort,
    modelLine,
    task: textField({ source: delegation.request, key: 'task' }),
    reason: textField({ source: delegation.request, key: 'reason' }),
    routingNote: routingNoteOf({ routing: delegation.routing, modelLine }),
    status,
    isRevision: delegation.reviseOf !== null,
    reviseVersion: delegation.baseRevision === null ? null : delegation.baseRevision + 1,
    isOpen: delegation.state !== 'settled',
    result:
      delegation.state === 'settled' ? delegationResultOf({ result: delegation.result }) : null,
  };
};
