import type { LedgerKind } from '@goodboy/core';

const LEDGER_KIND_WORD: Readonly<Record<LedgerKind, string>> = {
  script: 'Script',
  terminal: 'Terminal',
  turn: 'Agent',
  chat: 'Chat agent',
  planner: 'Planner',
  summary: 'Summary agent',
  probe: 'Probe',
};

type Params = {
  readonly kind: LedgerKind;
};

export const ledgerKindWord = ({ kind }: Params): string => LEDGER_KIND_WORD[kind];
