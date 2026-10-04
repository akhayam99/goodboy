import { NAMES } from '../../shared/names';

type RetiredName = {
  readonly id: string;
  readonly pattern: RegExp;
  readonly use: string;
};

export const RETIRED_NAMES: ReadonlyArray<RetiredName> = [
  { id: 'cancel-turn', pattern: /\bCancel turn\b/, use: NAMES.stop },
  { id: 'verbose', pattern: /\bVerbose\b/, use: NAMES.long },
  { id: 'spend-limit', pattern: /\b[Ss]pend limit\b/, use: NAMES.spendCap },
  { id: 'budget-rules', pattern: /\b[Bb]udget rules\b/, use: NAMES.spendCaps },
  { id: 'copy-as-brief', pattern: /\bCopy as brief\b/, use: NAMES.copyContext },
  { id: 'budget-cap', pattern: /\b[Bb]udget cap\b/, use: NAMES.spendCap },
];
