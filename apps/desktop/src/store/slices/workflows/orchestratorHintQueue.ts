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

export const activeOrchestratorHints = ({ hints }: HintsParams): ReadonlyArray<OrchestratorHint> =>
  hints.filter((hint) => hint.isPinned || hint.consumedAt == null);

export const hasHintArrivedSince = ({ hints, seenIds }: ArrivedParams): boolean =>
  activeOrchestratorHints({ hints }).some((hint) => seenIds.has(hint.id) === false);

export const consumeOrchestratorHints = ({
  hints,
  readIds,
  consumedAt,
  step,
}: ConsumeParams): ReadonlyArray<OrchestratorHint> =>
  hints.map((hint) =>
    readIds.has(hint.id) && hint.isPinned === false && hint.consumedAt == null
      ? { ...hint, consumedAt, consumedAtStep: step }
      : hint,
  );
