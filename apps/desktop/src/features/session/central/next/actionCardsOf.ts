import type { AgentId } from '@goodboy/types';
import type { AutoStuckKind } from '../../../auto/autoStuckKindOf';
import { autoStuckLineOf } from '../../../auto/autoStuckLineOf';
import type { NextStepBand, SessionSuggestion } from '../../../suggestions/types';
import type { NeedsYouOwner, NeedsYouOwnerKind } from '../../timeline/needsYou';

type AutoTargetKind = AutoStuckKind | 'approve' | 'blocked';

export type AutoActionTarget = {
  readonly agentId: AgentId;
  readonly rootAgentId: AgentId;
  readonly role: string;
  readonly kind: AutoTargetKind;
  readonly reason: string | null;
  readonly canRetry: boolean;
};

type ActionCardSource =
  | { readonly kind: 'owner'; readonly owner: NeedsYouOwner }
  | { readonly kind: 'suggestion'; readonly suggestion: SessionSuggestion }
  | { readonly kind: 'auto'; readonly target: AutoActionTarget };

type ActionCardKind = NeedsYouOwnerKind | SessionSuggestion['kind'] | AutoTargetKind;

export type ActionCardModel = {
  readonly id: string;
  readonly band: NextStepBand;
  readonly priority: number;
  readonly kind: ActionCardKind;
  readonly title: string;
  readonly detail: string | null;
  readonly mountId: string | null;
  readonly source: ActionCardSource;
};

type Params = {
  readonly owners: ReadonlyArray<NeedsYouOwner>;
  readonly suggestions: ReadonlyArray<SessionSuggestion>;
  readonly autoTargets: ReadonlyArray<AutoActionTarget>;
};

const PR_TARGET_PREFIX = 'pr:';

type OwnerParams = {
  readonly owner: NeedsYouOwner;
};

type SuggestionParams = {
  readonly suggestion: SessionSuggestion;
};

type AutoParams = {
  readonly target: AutoActionTarget;
};

type OwnedParams = SuggestionParams & {
  readonly ownedQuestionIds: ReadonlySet<string>;
};

const ownerBandOf = ({ owner }: OwnerParams): NextStepBand => {
  switch (owner.kind) {
    case 'question':
    case 'agent':
      return 0;
    case 'run':
      return owner.question === null ? 1 : 0;
    case 'fixRun':
    case 'rebase':
      return 1;
    default: {
      const exhaustive: never = owner.kind;
      return exhaustive;
    }
  }
};

const suggestionMountIdOf = ({ suggestion }: SuggestionParams): string | null => {
  if ('mountId' in suggestion.payload) {
    return suggestion.payload.mountId;
  }
  const { targetKey } = suggestion;
  if (targetKey !== null && targetKey.startsWith(PR_TARGET_PREFIX)) {
    return targetKey.slice(PR_TARGET_PREFIX.length);
  }
  return null;
};

const AUTO_STUCK = 'Auto is stuck';

const autoTitleOf = ({ target }: AutoParams): string => {
  switch (target.kind) {
    case 'neverStarted':
    case 'failed':
    case 'timedOut':
    case 'childBlocked':
      return AUTO_STUCK;
    case 'approve':
      return 'Auto waits on your OK';
    case 'blocked':
      return 'Auto is blocked';
    default: {
      const exhaustive: never = target.kind;
      return exhaustive;
    }
  }
};

const autoDetailOf = ({ target }: AutoParams): string | null => {
  const reason = target.reason === null || target.reason === '' ? null : target.reason;
  const { kind } = target;
  if (kind === 'approve' || kind === 'blocked') {
    return reason;
  }
  const line = `${autoStuckLineOf({ title: target.role, kind })}.`;
  return reason === null ? line : `${line} ${reason}`;
};

const ownerCardOf = ({ owner }: OwnerParams): ActionCardModel => ({
  id: `owner:${owner.id}`,
  band: ownerBandOf({ owner }),
  priority: 0,
  kind: owner.kind,
  title: owner.text,
  detail: owner.where,
  mountId: owner.owed?.target?.mountId ?? null,
  source: { kind: 'owner', owner },
});

const suggestionCardOf = ({ suggestion }: SuggestionParams): ActionCardModel => ({
  id: `suggestion:${suggestion.id}`,
  band: suggestion.band,
  priority: suggestion.priority,
  kind: suggestion.kind,
  title: suggestion.title,
  detail: suggestion.detail ?? null,
  mountId: suggestionMountIdOf({ suggestion }),
  source: { kind: 'suggestion', suggestion },
});

const autoCardOf = ({ target }: AutoParams): ActionCardModel => ({
  id: `auto:${target.agentId}:${target.kind}`,
  band: 0,
  priority: 0,
  kind: target.kind,
  title: autoTitleOf({ target }),
  detail: autoDetailOf({ target }),
  mountId: null,
  source: { kind: 'auto', target },
});

const isOwnedElsewhere = ({ suggestion, ownedQuestionIds }: OwnedParams): boolean =>
  suggestion.kind === 'answer-questions' &&
  suggestion.payload.firstQuestion !== null &&
  ownedQuestionIds.has(suggestion.payload.firstQuestion.id);

const compareCards = (first: ActionCardModel, second: ActionCardModel): number => {
  if (first.band !== second.band) {
    return first.band - second.band;
  }
  if (first.priority !== second.priority) {
    return first.priority - second.priority;
  }
  return first.id.localeCompare(second.id);
};

export const actionCardsOf = ({
  owners,
  suggestions,
  autoTargets,
}: Params): ReadonlyArray<ActionCardModel> => {
  const ownedQuestionIds = new Set(owners.flatMap((owner) => owner.questionIds));
  const cards = [
    ...owners.map((owner) => ownerCardOf({ owner })),
    ...suggestions
      .filter((suggestion) => !isOwnedElsewhere({ suggestion, ownedQuestionIds }))
      .map((suggestion) => suggestionCardOf({ suggestion })),
    ...autoTargets.map((target) => autoCardOf({ target })),
  ];
  return cards.sort(compareCards);
};
