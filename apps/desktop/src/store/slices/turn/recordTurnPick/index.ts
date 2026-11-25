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

type Executed = {
  readonly provider: string;
  readonly model: string;
};

type ExecutedParams = {
  readonly fields: Fields | null;
  readonly path: ReadonlyArray<string>;
  readonly executed: Executed;
};

type NestedParams = {
  readonly fields: Fields | null;
  readonly key: string;
};

const nestedOf = ({ fields, key }: NestedParams): Fields | null => {
  const value = fields === null ? null : fields[key];
  return isRecord(value) ? value : null;
};

const ranTheModelOf = ({ fields, path, executed }: ExecutedParams): boolean => {
  const holder = path.reduce<Fields | null>(
    (current, key) => nestedOf({ fields: current, key }),
    fields,
  );
  if (holder === null) {
    return true;
  }
  const provider = textFieldOf({ source: holder, key: 'provider' });
  const model = textFieldOf({ source: holder, key: 'model' });
  return (
    (provider === null || provider === executed.provider) &&
    (model === null || model === executed.model)
  );
};

type PickOfParams = RecordParams & {
  readonly executed: Executed;
};

const pickOf = ({ record, executed }: PickOfParams): TurnPick | null => {
  const delegation = fieldsOf({ raw: record.delegationRouting });
  if (delegation !== null) {
    const pick = delegationPickOf({ fields: delegation });
    const isOffPin =
      pick?.source === 'pinned' &&
      !ranTheModelOf({
        fields: delegation,
        path: nestedOf({ fields: delegation, key: 'pick' }) === null ? [] : ['pick'],
        executed,
      });
    return pick === null || !isOffPin ? pick : { ...pick, source: 'best' };
  }
  const decision = fieldsOf({ raw: record.routingDecision });
  if (decision !== null) {
    const pick = decisionPickOf({ fields: decision });
    const isOffPin =
      pick?.source === 'pinned' &&
      !ranTheModelOf({ fields: decision, path: ['selected'], executed });
    return pick === null || !isOffPin ? pick : { ...pick, source: 'best' };
  }
  const lock = fieldsOf({ raw: record.routingLock });
  if (lock === null) {
    return null;
  }
  return {
    source: ranTheModelOf({ fields: lock, path: ['pick'], executed }) ? 'pinned' : 'best',
    adjustment: null,
    requestedModel: null,
  };
};

type Params = {
  readonly runId: ProviderRunId;
  readonly agentId: AgentId;
  readonly provider: string;
  readonly model: string;
};

export const recordTurnPick = async ({
  runId,
  agentId,
  provider,
  model,
}: Params): Promise<void> => {
  try {
    const record = await readAgentPickRecord({ db: tauriDatabase, agentId });
    const pick = record === null ? null : pickOf({ record, executed: { provider, model } });
    if (pick === null) {
      return;
    }
    await insertAgentTurnPick({ db: tauriDatabase, pick: { runId, ...pick }, nowMs: Date.now() });
  } catch (error) {
    console.error('agent turn pick write failed', error);
  }
};
