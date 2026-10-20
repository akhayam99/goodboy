import { parseAutoDelegationRole } from '@goodboy/core';
import type { AutoDelegation } from '@goodboy/db';
import type { Agent, AgentId } from '@goodboy/types';
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
  readonly model: string | null;
};

const routingNoteOf = ({ routing, model }: NoteParams): string | null => {
  const proposal = textField({ source: routing, key: 'proposal' });
  if (proposal !== 'adjusted' && proposal !== 'replaced') {
    return null;
  }
  const requested = textField({
    source: recordField({ source: routing, key: 'requested' }),
    key: 'model',
  });
  const why = textField({ source: routing, key: 'reason' });
  const asked = requested === null ? 'Auto asked for another model' : `Auto asked for ${requested}`;
  const used = model === null ? 'the app chose' : `used ${model}`;
  return why === null ? `${asked}, ${used}.` : `${asked}, ${used}: ${why}`;
};

type Params = {
  readonly delegation: AutoDelegation;
  readonly childAgent: Agent | null;
};

export const delegationCardOf = ({ delegation, childAgent }: Params): DelegationCardModel => {
  const role = parseAutoDelegationRole({ role: delegation.role });
  const kind: AgentKind = role === null ? 'generic' : kindForRole({ role });
  const model = textField({ source: delegation.routing, key: 'model' });
  const status = delegationStatusOf({ delegation });
  return {
    delegationId: delegation.id,
    childAgentId: delegation.childAgentId,
    role: kind,
    roleLabel: AGENT_KIND_META[kind].noun,
    provider: textField({ source: delegation.routing, key: 'provider' }),
    model,
    effort: textField({ source: delegation.routing, key: 'effort' }),
    task: textField({ source: delegation.request, key: 'task' }),
    reason: textField({ source: delegation.request, key: 'reason' }),
    routingNote: routingNoteOf({ routing: delegation.routing, model }),
    status,
    isRevision: delegation.reviseOf !== null,
    reviseVersion: delegation.baseRevision === null ? null : delegation.baseRevision + 1,
    isOpen: delegation.state !== 'settled',
    result:
      delegation.state === 'settled' ? delegationResultOf({ result: delegation.result }) : null,
  };
};
