import type {
  ModelEffort,
  ModelRoutingProfile,
  ProviderId,
  WorkflowModelPick,
  WorkflowTaskProfile,
} from '@goodboy/types';
import type { ModelPriceSummary } from '../providers/model-price';

export type WorkflowModelCandidate = Readonly<{
  provider: ProviderId;
  model: string;
  effort: ModelEffort | null;
  contextWindow: number;
  profile: ModelRoutingProfile | null;
  price: ModelPriceSummary | null;
}>;

export type WorkflowModelRecommendation = Readonly<{
  pick: WorkflowModelPick;
  reason: string;
}>;

const UNASSESSED_FIT = 2;

type ContextParams = {
  readonly candidate: WorkflowModelCandidate;
  readonly contextEstimate: number | null;
};

const contextRank = ({ candidate, contextEstimate }: ContextParams): number => {
  if (contextEstimate === null) {
    return 0;
  }
  if (candidate.contextWindow >= contextEstimate) {
    return 0;
  }
  return 1;
};

type CandidateParams = {
  readonly candidate: WorkflowModelCandidate;
};

const priceRank = ({ candidate }: CandidateParams): number => {
  if (candidate.price === null) {
    return 1;
  }
  return 0;
};

const priceValue = ({ candidate }: CandidateParams): number => {
  const price = candidate.price;
  if (price === null) {
    return 0;
  }
  return price.inputPerMtok + price.outputPerMtok;
};

type FitParams = {
  readonly candidate: WorkflowModelCandidate;
  readonly profile: WorkflowTaskProfile | null;
};

const fitRank = ({ candidate, profile }: FitParams): number => {
  if (profile === null) {
    return UNASSESSED_FIT;
  }
  const routing = candidate.profile;
  if (routing === null) {
    return UNASSESSED_FIT;
  }
  if (routing.taskTypes.includes(profile.taskType) === false) {
    return UNASSESSED_FIT;
  }
  if (profile.difficulty === 'unknown') {
    return 1;
  }
  if (routing.preferredDifficulty.includes(profile.difficulty) === true) {
    return 0;
  }
  return 1;
};

const canonicalKey = ({ candidate }: CandidateParams): string =>
  `${candidate.provider}:${candidate.model}`;

type ReasonParams = {
  readonly candidate: WorkflowModelCandidate;
  readonly profile: WorkflowTaskProfile | null;
};

const recommendationReason = ({ candidate, profile }: ReasonParams): string => {
  const intent =
    profile === null
      ? 'Deterministic selection with no task profile.'
      : `Deterministic selection for ${profile.taskType} work at ${profile.difficulty} difficulty.`;
  const fit =
    fitRank({ candidate, profile }) === UNASSESSED_FIT
      ? 'Routing fit for this model is unassessed.'
      : 'A curated routing profile covers this task type.';
  const price =
    candidate.price === null
      ? 'Its published price is unknown.'
      : `Its published price is ${candidate.price.inputPerMtok} in and ${candidate.price.outputPerMtok} out per Mtok.`;
  if (profile !== null && profile.basis === 'heuristic') {
    return `${intent} That difficulty is a heuristic estimate read off the step text, not something the agent stated. ${fit} ${price}`;
  }
  return `${intent} ${fit} ${price}`;
};

type Params = {
  readonly candidates: ReadonlyArray<WorkflowModelCandidate>;
  readonly profile: WorkflowTaskProfile | null;
  readonly contextEstimate: number | null;
};

export const recommendWorkflowModel = ({
  candidates,
  profile,
  contextEstimate,
}: Params): WorkflowModelRecommendation | null => {
  const ranked = [...candidates].sort((left, right) => {
    const context =
      contextRank({ candidate: left, contextEstimate }) -
      contextRank({ candidate: right, contextEstimate });
    if (context !== 0) {
      return context;
    }
    const known = priceRank({ candidate: left }) - priceRank({ candidate: right });
    if (known !== 0) {
      return known;
    }
    const price = priceValue({ candidate: left }) - priceValue({ candidate: right });
    if (price !== 0) {
      return price;
    }
    const fit = fitRank({ candidate: left, profile }) - fitRank({ candidate: right, profile });
    if (fit !== 0) {
      return fit;
    }
    const leftKey = canonicalKey({ candidate: left });
    const rightKey = canonicalKey({ candidate: right });
    if (leftKey < rightKey) {
      return -1;
    }
    if (leftKey > rightKey) {
      return 1;
    }
    return 0;
  });
  const winner = ranked[0];
  if (winner === undefined) {
    return null;
  }
  return {
    pick: { provider: winner.provider, model: winner.model, effort: winner.effort },
    reason: recommendationReason({ candidate: winner, profile }),
  };
};
