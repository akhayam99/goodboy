import { RESOLVE_COMMIT_STYLES, type ResolveLaunchChoice } from '@goodboy/types';
import { isJsonRecord, parseJsonColumn } from '../shared/parseJsonColumn';

const textOrNull = ({ value }: { readonly value: unknown }): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const commitStyleOf = ({
  value,
}: {
  readonly value: unknown;
}): ResolveLaunchChoice['commitStyle'] =>
  RESOLVE_COMMIT_STYLES.find((style) => style === value) ?? null;

const choiceOf = ({ value }: { readonly value: unknown }): ResolveLaunchChoice | null => {
  if (!isJsonRecord(value)) {
    return null;
  }
  return {
    provider: textOrNull({ value: value.provider }),
    model: textOrNull({ value: value.model }),
    effort: textOrNull({ value: value.effort }),
    commitStyle: commitStyleOf({ value: value.commitStyle }),
    hint: textOrNull({ value: value.hint }),
  };
};

const isAnything = (value: unknown): value is unknown => value !== undefined;

export const EMPTY_LAUNCH_CHOICE: ResolveLaunchChoice = {
  provider: null,
  model: null,
  effort: null,
  commitStyle: null,
  hint: null,
};

export const parseLaunchChoice = ({
  json,
}: {
  readonly json: string | null;
}): ResolveLaunchChoice | null =>
  choiceOf({
    value: parseJsonColumn<unknown>({ value: json, isValid: isAnything, fallback: null }),
  });

export const serializeLaunchChoice = ({
  choice,
}: {
  readonly choice: ResolveLaunchChoice | null;
}): string | null => (choice === null ? null : JSON.stringify(choiceOf({ value: choice })));
