import {
  catalogModelForId,
  type Candidate,
  type CandidateCause,
  type CandidateList,
} from '@goodboy/core/providers';
import { cappedRoutingReason } from '@goodboy/core/orchestrator';
import { isProviderId } from '@goodboy/types/helpers';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import {
  askedCauseTextOf,
  childRoutingReason,
} from '../../runtime/auto/childRouting/childRoutingReason';

type AskedParams = {
  readonly provider: string;
  readonly model: string;
};

const askedLabel = ({ provider, model }: AskedParams): string => {
  if (!isProviderId(provider)) {
    return [provider, model].filter((part) => part !== '').join(' ');
  }
  const label = catalogModelForId({ provider, modelId: model })?.label ?? model;
  return `${PROVIDER_LABEL[provider]} ${label}`;
};

export type StepRoutingWhy =
  | Readonly<{ kind: 'rule'; candidate: Candidate; list: CandidateList }>
  | Readonly<{
      kind: 'moved';
      candidate: Candidate;
      list: CandidateList;
      cause: CandidateCause;
      asked: AskedParams;
    }>;

type Params = {
  readonly why: StepRoutingWhy;
};

export const stepRoutingReason = ({ why }: Params): string => {
  const line = childRoutingReason({
    why: { kind: 'rule', candidate: why.candidate, list: why.list },
  });
  if (why.kind === 'rule') {
    return cappedRoutingReason(line);
  }
  return cappedRoutingReason(
    `${askedLabel(why.asked)}: ${askedCauseTextOf({ asked: why.asked, cause: why.cause })}. ${line}.`,
  );
};
