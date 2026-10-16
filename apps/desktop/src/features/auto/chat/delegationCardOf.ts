import { AUTO_ATTEMPT_CEILING_USD, parseAutoDelegationRole } from '@goodboy/core';
import type { AutoDelegation } from '@goodboy/db';
import type { Agent, AgentId } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import { AGENT_KIND_META, kindForRole, type AgentKind } from '../../session/agent-kind';
import { delegationResultOf, type DelegationResultView } from './delegationResultOf';
import { recordField, textField } from './readJson';

type DelegationStatus = Readonly<{
  word: string;
  tone: Tone;
  isLive: boolean;
}>;

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
  startedAtMs: number | null;
  endedAtMs: number | null;
  ceilingUsd: number | null;
  isRevision: boolean;
  reviseVersion: number | null;
  isOpen: boolean;
  result: DelegationResultView | null;
}>;

type StatusParams = {
  readonly delegation: AutoDelegation;
};

const SETTLED_STATUS: Readonly<Record<NonNullable<AutoDelegation['outcome']>, DelegationStatus>> = {
  completed: { word: 'Done', tone: 'success', isLive: false },
  failed: { word: 'Failed', tone: 'danger', isLive: false },
  blocked: { word: 'Blocked', tone: 'warning', isLive: false },
  stopped: { word: 'Stopped', tone: 'neutral', isLive: false },
  timed_out: { word: 'Timed out', tone: 'warning', isLive: false },
};

const delegationStatusOf = ({ delegation }: StatusParams): DelegationStatus => {
  if (delegation.isStopping && delegation.state !== 'settled') {
    return { word: 'Stopping', tone: 'neutral', isLive: true };
  }
  switch (delegation.state) {
    case 'accepted':
      return { word: 'Queued', tone: 'neutral', isLive: false };
    case 'awaiting_confirm':
      return { word: 'Needs your OK', tone: 'warning', isLive: false };
    case 'starting':
      return { word: 'Starting', tone: 'info', isLive: true };
    case 'running':
      return { word: 'Running', tone: 'info', isLive: true };
    case 'paused':
      return { word: 'Waiting for an answer', tone: 'warning', isLive: false };
    case 'settled':
      return SETTLED_STATUS[delegation.outcome ?? 'failed'];
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

type TimeParams = {
  readonly value: string | null | undefined;
};

const msOf = ({ value }: TimeParams): number | null => {
  if (value == null) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
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
    startedAtMs: msOf({ value: childAgent?.startedAt }),
    endedAtMs:
      delegation.state === 'settled'
        ? (delegation.settledAt ?? msOf({ value: childAgent?.completedAt }))
        : null,
    ceilingUsd: role === null ? null : AUTO_ATTEMPT_CEILING_USD[role],
    isRevision: delegation.reviseOf !== null,
    reviseVersion: delegation.baseRevision === null ? null : delegation.baseRevision + 1,
    isOpen: delegation.state !== 'settled',
    result:
      delegation.state === 'settled' ? delegationResultOf({ result: delegation.result }) : null,
  };
};
