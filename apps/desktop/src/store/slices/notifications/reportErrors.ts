import { formatError } from '@goodboy/ui';
import type { ReportErrorParams } from './reportError';
import type { GetFn } from './types';

export type ActionFailure = {
  readonly title: string;
  readonly error: unknown;
};

type GroupTitleParams = {
  readonly count: number;
};

export type ReportErrorsParams = Omit<ReportErrorParams, 'title' | 'error'> & {
  readonly failures: ReadonlyArray<ActionFailure>;
  readonly groupTitleOf: (params: GroupTitleParams) => string;
};

type FactoryParams = {
  readonly get: GetFn;
};

type LineParams = {
  readonly failure: ActionFailure;
};

const failureLineOf = ({ failure }: LineParams): string => {
  const text = formatError(failure.error).trim();
  return text === '' ? failure.title : `${failure.title}: ${text}`;
};

export const reportErrors = ({ get }: FactoryParams) => {
  return async ({ failures, groupTitleOf, ...rest }: ReportErrorsParams) => {
    const [first] = failures;
    if (first === undefined) {
      return;
    }
    if (failures.length === 1) {
      await get().reportError({ ...rest, title: first.title, error: first.error });
      return;
    }
    await get().reportError({
      ...rest,
      title: groupTitleOf({ count: failures.length }),
      error: failures.map((failure) => failureLineOf({ failure })).join('\n'),
    });
  };
};
