import {
  CANDIDATE_CAUSES,
  catalogModelForId,
  type Candidate,
  type CandidateCause,
  type CandidateList,
} from '@goodboy/core/providers';
import { isProviderId } from '@goodboy/types/helpers';
import { PROVIDER_LABEL } from '../../../../features/providers/providerLabel';

type ModelParams = {
  readonly candidate: Pick<Candidate, 'provider' | 'model'>;
};

const modelLabel = ({ candidate }: ModelParams): string =>
  catalogModelForId({ provider: candidate.provider, modelId: candidate.model })?.label ??
  candidate.model;

type RuleParams = {
  readonly candidate: Candidate;
  readonly list: CandidateList;
};

const ruleLine = ({ candidate, list }: RuleParams): string => {
  const provider = PROVIDER_LABEL[candidate.provider];
  if (list.isPinned) {
    return `${modelLabel({ candidate })}: pinned for this role`;
  }
  if (candidate.isLighter) {
    return `${modelLabel({ candidate })}: lighter, fits the step`;
  }
  if (list.rule === 'load') {
    return `${provider}: most room left`;
  }
  const earlier = list.rows.find((row) => row.cause === null && row.order < candidate.order);
  if (earlier !== undefined) {
    const room =
      earlier.room === null ? 'near its limit' : `at ${earlier.room.usedPercent}% of its limit`;
    return `${provider}: ${PROVIDER_LABEL[earlier.provider]} is ${room}`;
  }
  const isFirst = list.rows.every((row) => row.order >= candidate.order);
  return isFirst
    ? `${provider}: first in your order`
    : `${provider}: first in your order that fits`;
};

type AskedParams = {
  readonly provider: string;
  readonly model: string;
};

const askedLabel = ({ provider, model }: AskedParams): string => {
  if (!isProviderId(provider)) {
    return `${provider} ${model}`;
  }
  const label = catalogModelForId({ provider, modelId: model })?.label ?? model;
  return `${PROVIDER_LABEL[provider]} ${label}`;
};

export type ChildRoutingWhy =
  | Readonly<{ kind: 'lead'; candidate: Candidate; leadReason: string | null }>
  | Readonly<{ kind: 'rule'; candidate: Candidate; list: CandidateList }>
  | Readonly<{
      kind: 'fallback';
      candidate: Candidate;
      list: CandidateList;
      cause: CandidateCause;
      asked: AskedParams;
    }>;

type Params = {
  readonly why: ChildRoutingWhy;
};

export const childRoutingReason = ({ why }: Params): string => {
  if (why.kind === 'lead') {
    const own = why.leadReason?.trim() ?? '';
    return own === '' ? `${PROVIDER_LABEL[why.candidate.provider]}: the Lead's pick` : own;
  }
  const line = ruleLine({ candidate: why.candidate, list: why.list });
  if (why.kind === 'rule') {
    return line;
  }
  return `The Lead asked for ${askedLabel({ ...why.asked })}: ${CANDIDATE_CAUSES[why.cause].text}. ${line}.`;
};
