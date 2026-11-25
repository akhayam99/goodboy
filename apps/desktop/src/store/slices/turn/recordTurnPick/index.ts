import {
  insertAgentTurnPick,
  readAgentPickRecord,
  type AgentPickRecord,
  type AgentTurnPick,
  type AgentTurnPickSource,
} from '@goodboy/db';
import type { AgentId, ProviderRunId } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import { tauriDatabase } from '../../../../shared/lib/db';
import { parseJsonOrNull } from '../../../../shared/utils/parseJsonOrNull';
import { textFieldOf } from '../../../../shared/utils/textFieldOf';

type Fields = Readonly<Record<string, unknown>>;

type TurnPick = Omit<AgentTurnPick, 'runId'>;

const DELEGATION_SOURCES: ReadonlyMap<string, AgentTurnPickSource> = new Map([
  ['lead', 'lead'],
  ['fallback', 'fallback'],
  ['pin', 'pinned'],
  ['lock', 'pinned'],
  ['rule', 'best'],
]);

const PROPOSAL_SOURCES: ReadonlyMap<string, AgentTurnPickSource> = new Map([
  ['kept', 'lead'],
  ['adjusted', 'lead'],
  ['replaced', 'fallback'],
  ['none', 'best'],
]);

const PINNED_DECISIONS: ReadonlySet<string> = new Set(['step_lock', 'run_role_lock']);

type RawParams = {
  readonly raw: string | null;
};

const fieldsOf = ({ raw }: RawParams): Fields | null => {
  if (raw === null) {
    return null;
  }
  const value = parseJsonOrNull({ raw });
  return isRecord(value) ? value : null;
};

type FieldsParams = {
  readonly fields: Fields;
};

const modelOf = ({ fields }: FieldsParams): string | null =>
  isRecord(fields.requested) ? textFieldOf({ source: fields.requested, key: 'model' }) : null;

const delegationPickOf = ({ fields }: FieldsParams): TurnPick | null => {
  const source =
    DELEGATION_SOURCES.get(textFieldOf({ source: fields, key: 'source' }) ?? '') ??
    PROPOSAL_SOURCES.get(textFieldOf({ source: fields, key: 'proposal' }) ?? '');
  if (source === undefined) {
    return null;
  }
  const proposal = textFieldOf({ source: fields, key: 'proposal' });
  return {
    source,
    adjustment:
      textFieldOf({ source: fields, key: 'cause' }) ?? (proposal === 'adjusted' ? proposal : null),
    requestedModel: modelOf({ fields }),
  };
};

const decisionPickOf = ({ fields }: FieldsParams): TurnPick | null => {
  const source = textFieldOf({ source: fields, key: 'source' });
  if (source === null) {
    return null;
  }
  const adjustment = textFieldOf({ source: fields, key: 'adjustment' });
  const proposal = isRecord(fields.proposal) ? fields.proposal : null;
  return {
    source: PINNED_DECISIONS.has(source) ? 'pinned' : 'best',
    adjustment: adjustment === 'none' ? null : adjustment,
    requestedModel:
      proposal !== null && isRecord(proposal.pick)
        ? textFieldOf({ source: proposal.pick, key: 'model' })
        : null,
  };
};

type RecordParams = {
  readonly record: AgentPickRecord;
};

const pickOf = ({ record }: RecordParams): TurnPick | null => {
  const delegation = fieldsOf({ raw: record.delegationRouting });
  if (delegation !== null) {
    return delegationPickOf({ fields: delegation });
  }
  const decision = fieldsOf({ raw: record.routingDecision });
  if (decision !== null) {
    return decisionPickOf({ fields: decision });
  }
  return fieldsOf({ raw: record.routingLock }) === null
    ? null
    : { source: 'pinned', adjustment: null, requestedModel: null };
};

type Params = {
  readonly runId: ProviderRunId;
  readonly agentId: AgentId;
};

export const recordTurnPick = async ({ runId, agentId }: Params): Promise<void> => {
  try {
    const record = await readAgentPickRecord({ db: tauriDatabase, agentId });
    const pick = record === null ? null : pickOf({ record });
    if (pick === null) {
      return;
    }
    await insertAgentTurnPick({ db: tauriDatabase, pick: { runId, ...pick }, nowMs: Date.now() });
  } catch (error) {
    console.error('agent turn pick write failed', error);
  }
};
