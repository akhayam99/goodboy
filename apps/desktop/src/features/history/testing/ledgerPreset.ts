import type { HistoryStep } from '@goodboy/types';
import { combineInto, initialPlanItems, moveAbove, rewordStep, setVerb } from '../historyPlan';
import { LEDGER, LEDGER_COMMITS } from './ledgerFixture';

export const LEDGER_RENAME = 'Verify webhook signatures before crediting';

const steps: ReadonlyArray<(items: ReadonlyArray<HistoryStep>) => ReadonlyArray<HistoryStep>> = [
  (items) => combineInto({ items, sha: LEDGER.f, target: LEDGER.a, mode: 'fixup' }),
  (items) => moveAbove({ items, sha: LEDGER.d, anchor: LEDGER.b }),
  (items) => combineInto({ items, sha: LEDGER.e, target: LEDGER.d, mode: 'squash' }),
  (items) =>
    rewordStep({
      items,
      sha: LEDGER.c,
      message: LEDGER_RENAME,
      original: 'Fix webhook signature check',
    }),
  (items) => setVerb({ items, sha: LEDGER.x, verb: 'drop' }),
];

export const LEDGER_PRESET: ReadonlyArray<HistoryStep> = steps.reduce(
  (items, apply) => apply(items),
  initialPlanItems({ commits: LEDGER_COMMITS }),
);
