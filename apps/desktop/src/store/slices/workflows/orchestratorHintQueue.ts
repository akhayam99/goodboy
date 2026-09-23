import type { IsoDateTime, OrchestratorHint } from '@goodboy/types';

type HintsParams = {
  readonly hints: ReadonlyArray<OrchestratorHint>;
};

type ArrivedParams = HintsParams & {
  readonly seenIds: ReadonlySet<string>;
};

type ConsumeParams = HintsParams & {
  readonly readIds: ReadonlySet<string>;
  readonly consumedAt: IsoDateTime;
  readonly step: number;
};

const HINTS_HEADER =
  'Everything the operator told you during this run, oldest first. Each hint lives for the whole run: judge from its wording whether it still applies. A newer hint wins over an older one it contradicts.';

export const formatOrchestratorHints = ({ hints }: HintsParams): string => {
  if (hints.length === 0) {
    return '';
  }
  const lines = hints.map((hint) =>
    hint.consumedAtStep == null
      ? `- [new] ${hint.text}`
      : `- [since step ${hint.consumedAtStep}] ${hint.text}`,
  );
  return [HINTS_HEADER, ...lines].join('\n');
};

export const hasHintArrivedSince = ({ hints, seenIds }: ArrivedParams): boolean =>
  hints.some((hint) => seenIds.has(hint.id) === false);

export const consumeOrchestratorHints = ({
  hints,
  readIds,
  consumedAt,
  step,
}: ConsumeParams): ReadonlyArray<OrchestratorHint> =>
  hints.map((hint) =>
    readIds.has(hint.id) && hint.consumedAt == null
      ? { ...hint, consumedAt, consumedAtStep: step }
      : hint,
  );
