import type { NextStepNudgeKind, NudgeEvent } from '@goodboy/db';
import type { NextStepOutcome } from './nextStepGates';
import { SUGGESTION_KINDS, type SuggestionKind } from './types';

const KIND_SET: ReadonlySet<string> = new Set(SUGGESTION_KINDS);

export const nextStepNudgeKind = ({ kind }: { readonly kind: SuggestionKind }): NextStepNudgeKind =>
  `next:${kind}`;

export const suggestionKindFromNudgeKind = ({
  kind,
}: {
  readonly kind: string;
}): SuggestionKind | null => {
  if (!kind.startsWith('next:')) {
    return null;
  }
  const candidate = kind.slice('next:'.length);
  return KIND_SET.has(candidate) ? (candidate as SuggestionKind) : null;
};

export const toNextStepOutcomes = ({
  events,
}: {
  readonly events: ReadonlyArray<NudgeEvent>;
}): ReadonlyArray<NextStepOutcome> =>
  events.flatMap((event) => {
    const kind = suggestionKindFromNudgeKind({ kind: event.kind });
    if (kind === null || event.outcome === null) {
      return [];
    }
    return [{ kind, outcome: event.outcome, at: event.outcomeTs ?? event.ts }];
  });

const fingerprintOf = ({ event }: { readonly event: NudgeEvent }): string | null => {
  if (event.contextJson === null) {
    return null;
  }
  try {
    const parsed = JSON.parse(event.contextJson) as { readonly fingerprint?: unknown };
    return typeof parsed.fingerprint === 'string' ? parsed.fingerprint : null;
  } catch {
    return null;
  }
};

export const dismissedFingerprintsFromEvents = ({
  events,
}: {
  readonly events: ReadonlyArray<NudgeEvent>;
}): ReadonlySet<string> => {
  const sorted = [...events].sort(
    (first, second) =>
      Date.parse(first.outcomeTs ?? first.ts) - Date.parse(second.outcomeTs ?? second.ts),
  );
  const dismissed = new Set<string>();
  for (const event of sorted) {
    const fingerprint = fingerprintOf({ event });
    if (fingerprint === null || event.outcome === null) {
      continue;
    }
    if (event.outcome === 'dismissed') {
      dismissed.add(fingerprint);
      continue;
    }
    dismissed.delete(fingerprint);
  }
  return dismissed;
};
