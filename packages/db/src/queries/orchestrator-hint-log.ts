import type { IsoDateTime, OrchestratorHint } from '@goodboy/types';

type HintLogColumn = {
  readonly value: string | null;
};

type UnknownRecord = Record<string, unknown>;

const isUnknownRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value != null && Array.isArray(value) === false;

const isIsoTimestamp = (value: unknown): value is IsoDateTime =>
  typeof value === 'string' && Number.isNaN(Date.parse(value)) === false;

type HintEntryParams = {
  readonly entry: unknown;
};

type SerializeParams = {
  readonly hints: ReadonlyArray<OrchestratorHint>;
};

const toHint = ({ entry }: HintEntryParams): OrchestratorHint | null => {
  if (isUnknownRecord(entry) === false) {
    return null;
  }
  const { id, text, isPinned, createdAt, consumedAt, consumedAtStep } = entry;
  if (
    typeof id !== 'string' ||
    id === '' ||
    typeof text !== 'string' ||
    text.trim() === '' ||
    isIsoTimestamp(createdAt) === false
  ) {
    return null;
  }
  return {
    id,
    text,
    isPinned: isPinned === true,
    createdAt,
    ...(isIsoTimestamp(consumedAt) && { consumedAt }),
    ...(typeof consumedAtStep === 'number' &&
      Number.isInteger(consumedAtStep) && { consumedAtStep }),
  };
};

export const toOrchestratorHintLog = ({
  value,
}: HintLogColumn): ReadonlyArray<OrchestratorHint> => {
  if (value == null || value === '') {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) === false) {
      return [];
    }
    return parsed.flatMap((entry: unknown) => {
      const hint = toHint({ entry });
      return hint == null ? [] : [hint];
    });
  } catch {
    return [];
  }
};

export const serializeOrchestratorHintLog = ({ hints }: SerializeParams): string | null =>
  hints.length === 0 ? null : JSON.stringify(hints);
