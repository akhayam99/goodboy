import { parseAutoDelegationRole } from '@goodboy/core/auto';
import type { AutoDelegation, AutoOutcome } from '@goodboy/db';
import type { Agent, AgentId } from '@goodboy/types';
import { modelLineOf, type ModelLine } from '../../providers/modelLine/modelLineOf';
import { AGENT_KIND_META, kindForRole, type AgentKind } from '../../session/agent-kind';
import { autoChildWordOf } from '../autoChildWordOf';
import { autoSettledStateOf } from '../autoSettledStateOf';
import { delegationResultOf, type DelegationResultView } from './delegationResultOf';
import { recordField, textField } from './readJson';
import { settledStatusOf, type DelegationStatus } from './settledStatusOf';

export type RoleKept = Readonly<{
  fitLabel: string;
  reason: string;
}>;

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
  roleKept: RoleKept | null;
  routingNote: string | null;
  status: DelegationStatus;
  isRevision: boolean;
  reviseVersion: number | null;
  isOpen: boolean;
  result: DelegationResultView | null;
}>;

type StatusParams = {
  readonly delegation: AutoDelegation;
  readonly isReplaced: boolean;
};

const RETURNED: DelegationStatus = {
  state: 'returned',
  word: autoChildWordOf({ state: 'returned' }),
  tone: 'neutral',
  isLive: false,
  node: 'skipped',
};

const settledStatusOfDelegation = ({ delegation, isReplaced }: StatusParams): DelegationStatus => {
  const outcome = delegation.outcome ?? 'failed';
  if (outcome !== 'blocked') {
    return settledStatusOf({ outcome });
  }
  return autoSettledStateOf({ outcome, isReplaced }) === 'done'
    ? settledStatusOf({ outcome: 'completed' })
    : RETURNED;
};

const resultOutcomeOf = ({
  delegation,
  isReplaced,
}: StatusParams): AutoOutcome | null | undefined => {
  if (delegation.outcome !== 'blocked') {
    return undefined;
  }
  return autoSettledStateOf({ outcome: delegation.outcome, isReplaced }) === 'done'
    ? 'completed'
    : null;
};

const delegationStatusOf = ({ delegation, isReplaced }: StatusParams): DelegationStatus => {
  if (delegation.isStopping && delegation.state !== 'settled') {
    return { state: 'stopping', word: 'Stopping', tone: 'neutral', isLive: true };
  }
  switch (delegation.state) {
    case 'accepted':
      return { state: 'queued', word: 'Queued', tone: 'neutral', isLive: false };
    case 'awaiting_confirm':
      return {
        state: 'confirming',
        word: 'Needs you',
        tone: 'warning',
        isLive: false,
        node: 'approval',
      };
    case 'starting':
      return { state: 'starting', word: 'Starting', tone: 'info', isLive: true };
    case 'running':
      return { state: 'running', word: 'Running', tone: 'info', isLive: true };
    case 'paused':
      return {
        state: 'paused',
        word: 'Needs you',
        tone: 'warning',
        isLive: false,
        node: 'question',
      };
    case 'settled':
      return settledStatusOfDelegation({ delegation, isReplaced });
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

type RoleKeptParams = {
  readonly request: unknown;
};

const roleKeptOf = ({ request }: RoleKeptParams): RoleKept | null => {
  const fit = parseAutoDelegationRole({ role: textField({ source: request, key: 'roleFit' }) });
  const reason = textField({ source: request, key: 'roleReason' });
  if (fit === null || reason === null) {
    return null;
  }
  return { fitLabel: AGENT_KIND_META[kindForRole({ role: fit })].noun, reason };
};

type Params = {
  readonly delegation: AutoDelegation;
  readonly childAgent: Agent | null;
  readonly isReplaced?: boolean;
};

export const delegationCardOf = ({
  delegation,
  childAgent,
  isReplaced = false,
}: Params): DelegationCardModel => {
  const role = parseAutoDelegationRole({ role: delegation.role });
  const kind: AgentKind = role === null ? 'generic' : kindForRole({ role });
  const provider = textField({ source: delegation.routing, key: 'provider' });
  const model = textField({ source: delegation.routing, key: 'model' });
  const effort = textField({ source: delegation.routing, key: 'effort' });
  const modelLine = modelLineOf({ provider, model, effort });
  const status = delegationStatusOf({ delegation, isReplaced });
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
    roleKept: roleKeptOf({ request: delegation.request }),
    routingNote: routingNoteOf({ routing: delegation.routing, modelLine }),
    status,
    isRevision: delegation.reviseOf !== null,
    reviseVersion: delegation.baseRevision === null ? null : delegation.baseRevision + 1,
    isOpen: delegation.state !== 'settled',
    result:
      delegation.state === 'settled'
        ? delegationResultOf({
            result: delegation.result,
            outcome: resultOutcomeOf({ delegation, isReplaced }),
          })
        : null,
  };
};
