import type { SessionSuggestion, SuggestionKind } from './types';

const FIVE_MINUTES_MS = 5 * 60 * 1_000;

type IsFreshParams = {
  readonly fetchedAt: string | null;
  readonly now: () => number;
  readonly maxAgeMs?: number;
};

export const isFresh = ({ fetchedAt, now, maxAgeMs = FIVE_MINUTES_MS }: IsFreshParams): boolean => {
  if (fetchedAt === null) {
    return true;
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

const DEMOTION_OFFSET = 1_000;

type ApplyLearnedDemotionParams = {
  readonly suggestions: ReadonlyArray<SessionSuggestion>;
  readonly demotedKinds?: ReadonlySet<SuggestionKind>;
};

export const sortPriority = ({
  suggestion,
  demotedKinds,
}: {
  readonly suggestion: SessionSuggestion;
  readonly demotedKinds?: ReadonlySet<SuggestionKind>;
}): number =>
  demotedKinds !== undefined && demotedKinds.has(suggestion.kind)
    ? suggestion.priority + DEMOTION_OFFSET
    : suggestion.priority;

export const sortNextSteps = ({
  suggestions,
  demotedKinds,
}: ApplyLearnedDemotionParams): ReadonlyArray<SessionSuggestion> =>
  [...suggestions].sort(
    (first, second) =>
      sortPriority({ suggestion: first, demotedKinds }) -
        sortPriority({ suggestion: second, demotedKinds }) || first.id.localeCompare(second.id),
  );

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
