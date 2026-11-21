import { moveGroupOf } from './moveGroupOf';
import type { MoveGroup, SessionSuggestion, SuggestionKind } from './types';

const FRESH_READ_MS = 8 * 60 * 1_000;

type IsFreshParams = {
  readonly fetchedAt: string | null;
  readonly now: () => number;
  readonly maxAgeMs?: number;
};

export const isFresh = ({ fetchedAt, now, maxAgeMs = FRESH_READ_MS }: IsFreshParams): boolean => {
  if (fetchedAt === null) {
    return false;
  }
  const age = now() - Date.parse(fetchedAt);
  return age <= maxAgeMs;
};

type DedupeByTargetKeyParams = {
  readonly suggestions: ReadonlyArray<SessionSuggestion>;
};

export const dedupeByTargetKey = ({
  suggestions,
}: DedupeByTargetKeyParams): ReadonlyArray<SessionSuggestion> => {
  const bestByTargetKey = new Map<string, SessionSuggestion>();
  const untargeted: SessionSuggestion[] = [];
  for (const suggestion of suggestions) {
    if (suggestion.targetKey === null) {
      untargeted.push(suggestion);
      continue;
    }
    const existing = bestByTargetKey.get(suggestion.targetKey);
    if (existing === undefined || suggestion.band < existing.band) {
      bestByTargetKey.set(suggestion.targetKey, suggestion);
    }
  }
  return [...untargeted, ...bestByTargetKey.values()];
};

type ApplyDismissalsParams = {
  readonly suggestions: ReadonlyArray<SessionSuggestion>;
  readonly dismissedFingerprints?: ReadonlySet<string>;
};

export const applyDismissals = ({
  suggestions,
  dismissedFingerprints,
}: ApplyDismissalsParams): ReadonlyArray<SessionSuggestion> => {
  if (dismissedFingerprints === undefined || dismissedFingerprints.size === 0) {
    return suggestions;
  }
  return suggestions.filter((suggestion) => !dismissedFingerprints.has(suggestion.fingerprint));
};

type ApplyLearnedDemotionParams = {
  readonly suggestions: ReadonlyArray<SessionSuggestion>;
  readonly demotedKinds?: ReadonlySet<SuggestionKind>;
};

const GROUP_ORDER: Readonly<Record<MoveGroup, number>> = {
  unblock: 0,
  advance: 1,
  upkeep: 2,
};

const DEMOTED_TIER = 3;

type TierParams = {
  readonly suggestion: SessionSuggestion;
  readonly demotedKinds?: ReadonlySet<SuggestionKind>;
};

const moveTierOf = ({ suggestion, demotedKinds }: TierParams): number => {
  const group = GROUP_ORDER[moveGroupOf({ suggestion })];
  return demotedKinds !== undefined && demotedKinds.has(suggestion.kind)
    ? DEMOTED_TIER + group
    : group;
};

type CompareParams = {
  readonly first: SessionSuggestion;
  readonly second: SessionSuggestion;
  readonly demotedKinds?: ReadonlySet<SuggestionKind>;
};

const compareNextSteps = ({ first, second, demotedKinds }: CompareParams): number => {
  const tierGap =
    moveTierOf({ suggestion: first, demotedKinds }) -
    moveTierOf({ suggestion: second, demotedKinds });
  if (tierGap !== 0) {
    return tierGap;
  }
  const priorityGap = first.priority - second.priority;
  if (priorityGap !== 0) {
    return priorityGap;
  }
  return first.id.localeCompare(second.id);
};

export const sortNextSteps = ({
  suggestions,
  demotedKinds,
}: ApplyLearnedDemotionParams): ReadonlyArray<SessionSuggestion> =>
  [...suggestions].sort((first, second) => compareNextSteps({ first, second, demotedKinds }));

export type NextStepOutcome = {
  readonly kind: SuggestionKind;
  readonly outcome: 'accepted' | 'dismissed' | 'overridden' | 'ignored';
  readonly at: string;
};

type ShouldDemoteParams = {
  readonly kind: SuggestionKind;
  readonly outcomes: ReadonlyArray<NextStepOutcome>;
  readonly now: () => number;
  readonly windowDays?: number;
  readonly dismissalThreshold?: number;
};

export const shouldDemote = ({
  kind,
  outcomes,
  now,
  windowDays = 14,
  dismissalThreshold = 3,
}: ShouldDemoteParams): boolean => {
  const windowMs = windowDays * 24 * 60 * 60 * 1_000;
  const cutoff = now() - windowMs;
  const inWindow = outcomes.filter(
    (outcome) => outcome.kind === kind && Date.parse(outcome.at) >= cutoff,
  );
  const hasAcceptance = inWindow.some((outcome) => outcome.outcome === 'accepted');
  if (hasAcceptance) {
    return false;
  }
  const dismissals = inWindow.filter((outcome) => outcome.outcome === 'dismissed').length;
  return dismissals >= dismissalThreshold;
};
