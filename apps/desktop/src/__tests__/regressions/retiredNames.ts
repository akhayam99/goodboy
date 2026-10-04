import { NAMES } from '../../shared/names';

type RetiredName = {
  readonly id: string;
  readonly pattern: RegExp;
  readonly use: string;
};

export const RETIRED_NAMES: ReadonlyArray<RetiredName> = [
  { id: 'cancel-turn', pattern: /\bCancel turn\b/, use: NAMES.stop },
  { id: 'verbose', pattern: /\bVerbose\b/, use: NAMES.long },
];
