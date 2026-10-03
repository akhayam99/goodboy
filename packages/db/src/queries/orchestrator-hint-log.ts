import type { IsoDateTime, OrchestratorHint } from '@goodboy/types';
import { isJsonArray, parseJsonColumn } from '../shared/parseJsonColumn';

type HintLogColumn = {
  readonly value: string | null;
};

type UnknownRecord = Record<string, unknown>;

const isUnknownRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value != null && Array.isArray(value) === false;

const isIsoTimestamp = (value: unknown): value is IsoDateTime =>
  typeof value === 'string' && Number.isNaN(Date.parse(value)) === false;

const isIdList = (value: unknown): value is ReadonlyArray<string> =>
  Array.isArray(value) && value.every((item) => typeof item === 'string' && item !== '');

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
  const { id, text, createdAt, consumedAt, consumedAtStep, attachmentIds } = entry;
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
    createdAt,
    ...(isIsoTimestamp(consumedAt) && { consumedAt }),
    ...(typeof consumedAtStep === 'number' &&
      Number.isInteger(consumedAtStep) && { consumedAtStep }),
    ...(isIdList(attachmentIds) && attachmentIds.length > 0 && { attachmentIds }),
  };
};

export const toOrchestratorHintLog = ({
  value,
}: HintLogColumn): ReadonlyArray<OrchestratorHint> => {
  const parsed = parseJsonColumn({ value, isValid: isJsonArray, fallback: [] });
  return parsed.flatMap((entry) => {
    const hint = toHint({ entry });
    return hint == null ? [] : [hint];
  });
};

export const serializeOrchestratorHintLog = ({ hints }: SerializeParams): string | null =>
  hints.length === 0 ? null : JSON.stringify(hints);
