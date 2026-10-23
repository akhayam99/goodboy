import type { AgentId } from '@goodboy/types';
import type { AutoPlanFacts } from '../../../auto/autoRetryTargetsOf';
import type { AutoStuckKind } from '../../../auto/autoStuckKindOf';
import { autoStuckVerbOf } from '../../../auto/autoStuckVerbOf';
import { delegationReasonTextOf } from '../../../auto/delegationReasonTextOf';
import type { NextStepBand, SessionSuggestion } from '../../../suggestions/types';
import type { NeedsYouOwner, NeedsYouOwnerKind } from '../../timeline/needsYou';
import { planSentenceOf } from './planSentenceOf';

type AutoTargetKind = AutoStuckKind | 'approve' | 'blocked';

export type AutoActionTarget = {
  readonly agentId: AgentId;
  readonly rootAgentId: AgentId;
  readonly role: string;
  readonly noun: string;
  readonly kind: AutoTargetKind;
  readonly reason: string | null;
  readonly reasonCode: string | null;
  readonly mountId: string | null;
  readonly plan: AutoPlanFacts | null;
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
  readonly folded: ReadonlyArray<ActionCardModel>;
};

type Params = {
  readonly owners: ReadonlyArray<NeedsYouOwner>;
  readonly suggestions: ReadonlyArray<SessionSuggestion>;
  readonly autoTargets: ReadonlyArray<AutoActionTarget>;
};

const PR_TARGET_PREFIX = 'pr:';

const NO_CARDS: ReadonlyArray<ActionCardModel> = [];

const NO_MOUNTS: ReadonlySet<string> = new Set();

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

const DECLARED_BLOCKED = 'declared_blocked';

const autoTitleOf = ({ target }: AutoParams): string => {
  switch (target.kind) {
    case 'neverStarted':
    case 'failed':
    case 'timedOut':
    case 'childBlocked':
      return AUTO_STUCK;
    case 'approve':
      return target.plan?.name ?? 'Auto waits on your OK';
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
  if (kind === 'approve') {
    return planSentenceOf({ plan: target.plan, questionCount: 0 });
  }
  if (kind === 'blocked') {
    return reason;
  }
  const line = `The ${target.noun.toLowerCase()} ${autoStuckVerbOf({ kind })}.`;
  const why = humanReasonOf({ target });
  return why === null ? line : `${line} ${why}`;
};

const humanReasonOf = ({ target }: AutoParams): string | null => {
  if (target.reasonCode === null) {
    return target.kind === 'childBlocked' ? null : target.reason;
  }
  if (target.reasonCode === DECLARED_BLOCKED) {
    return null;
  }
  return delegationReasonTextOf({ reason: target.reasonCode });
};

const ownerCardOf = ({ owner }: OwnerParams): ActionCardModel => ({
  id: `owner:${owner.id}`,
  band: ownerBandOf({ owner }),
  priority: 0,
  kind: owner.kind,
  title: owner.text,
  detail: owner.where,
  mountId: owner.mountId,
  source: { kind: 'owner', owner },
  folded: NO_CARDS,
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
  folded: NO_CARDS,
});

const autoCardOf = ({ target }: AutoParams): ActionCardModel => ({
  id: `auto:${target.agentId}:${target.kind}`,
  band: 0,
  priority: 0,
  kind: target.kind,
  title: autoTitleOf({ target }),
  detail: autoDetailOf({ target }),
  mountId: target.mountId,
  source: { kind: 'auto', target },
  folded: NO_CARDS,
});

type CardsParams = {
  readonly cards: ReadonlyArray<ActionCardModel>;
};

type CardParams = {
  readonly card: ActionCardModel;
};

type FoldParams = CardParams & {
  readonly behindIds: ReadonlySet<string>;
};

const behindMountIdsOf = ({ card }: CardParams): ReadonlySet<string> =>
  card.source.kind === 'suggestion' && card.source.suggestion.kind === 'rebase-project'
    ? new Set(card.source.suggestion.payload.targets.map((target) => target.mountId))
    : NO_MOUNTS;

const isFoldedRebase = ({ card, behindIds }: FoldParams): boolean =>
  card.kind === 'rebase' && card.mountId !== null && behindIds.has(card.mountId);

const foldStoppedRebases = ({ cards }: CardsParams): ReadonlyArray<ActionCardModel> => {
  const behind = cards.find((card) => behindMountIdsOf({ card }).size > 0);
  if (behind === undefined) {
    return cards;
  }
  const behindIds = behindMountIdsOf({ card: behind });
  const folded = cards.filter((card) => isFoldedRebase({ card, behindIds }));
  if (folded.length === 0) {
    return cards;
  }
  const stopped = `${folded.length} ${folded.length === 1 ? 'rebase' : 'rebases'} stopped`;
  return cards
    .filter((card) => !isFoldedRebase({ card, behindIds }))
    .map((card) =>
      card === behind
        ? {
            ...card,
            detail: card.detail === null ? stopped : `${card.detail} · ${stopped}`,
            folded: [...card.folded, ...folded],
          }
        : card,
    );
};

const isDiverged = ({ card }: CardParams): boolean =>
  card.source.kind === 'suggestion' &&
  card.source.suggestion.kind === 'push-branch' &&
  card.source.suggestion.payload.state === 'diverged';

const foldDivergedIntoStops = ({ cards }: CardsParams): ReadonlyArray<ActionCardModel> => {
  const stopMounts = new Set(
    cards.flatMap((card) =>
      card.kind === 'rebase' && card.source.kind === 'owner' && card.mountId !== null
        ? [card.mountId]
        : [],
    ),
  );
  const isFolded = ({ card }: CardParams): boolean =>
    isDiverged({ card }) && card.mountId !== null && stopMounts.has(card.mountId);
  const diverged = cards.filter((card) => isFolded({ card }));
  if (diverged.length === 0) {
    return cards;
  }
  return cards
    .filter((card) => !isFolded({ card }))
    .map((card) => {
      if (card.kind !== 'rebase' || card.source.kind !== 'owner') {
        return card;
      }
      const mine = diverged.filter((other) => other.mountId === card.mountId);
      return mine.length === 0 ? card : { ...card, folded: [...card.folded, ...mine] };
    });
};

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
  return foldStoppedRebases({ cards: foldDivergedIntoStops({ cards: cards.sort(compareCards) }) });
};
