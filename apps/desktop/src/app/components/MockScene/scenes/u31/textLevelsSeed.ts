import type { ChipProps, ListGridColumn } from '@goodboy/ui';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-30T12:40:00.000Z' });

export const LEVELS_TITLE = 'Duplicate credit fix';

export const LEVELS_META = 'payments-api · hl/fix-duplicate-credit · Retry-safe';

export const LEVELS_PROSE =
  'The retry loop builds a new idempotency key on every attempt, so a credit that timed out after the ledger wrote it can post twice.';

export const LEVELS_HYPHEN = 'Read-only plan: payments-api, notify-relay';

export const LEVELS_GROUP = 'Runs';

export const LEVELS_COLUMNS = [
  { key: 'title', width: 'fill', isTitle: true },
  { key: 'state', width: 96 },
  { key: 'scouts', width: 48, align: 'end', isNumeric: true, tone: 'hint' },
  { key: 'cost', width: 56, align: 'end', isNumeric: true },
  { key: 'age', width: 56, align: 'end', isNumeric: true, tone: 'hint' },
] as const satisfies ReadonlyArray<ListGridColumn>;

export type LevelsRun = {
  readonly id: string;
  readonly title: string;
  readonly second: string;
  readonly state: string;
  readonly tone: ChipProps['tone'];
  readonly scouts: number;
  readonly costUsd: number;
  readonly startedAt: string;
};

export const LEVELS_RUNS: ReadonlyArray<LevelsRun> = [
  {
    id: 'trace',
    title: 'Trace where a retried webhook posts',
    second: 'Step 1 · Scout · 3 scouts done',
    state: 'Running',
    tone: 'info',
    scouts: 3,
    costUsd: 0.12,
    startedAt: clock.iso({ at: '2026-10-30T12:38:00.000Z' }),
  },
  {
    id: 'key',
    title: 'Build the idempotency key once',
    second: 'Implementer · notify-relay',
    state: 'Needs you',
    tone: 'warning',
    scouts: 12,
    costUsd: 1.48,
    startedAt: clock.iso({ at: '2026-10-30T11:55:00.000Z' }),
  },
  {
    id: 'ledger',
    title: 'Review the ledger-core side',
    second: 'Reviewer · hl/fix-duplicate-credit',
    state: 'Done',
    tone: 'success',
    scouts: 1,
    costUsd: 0.74,
    startedAt: clock.iso({ at: '2026-10-30T09:40:00.000Z' }),
  },
  {
    id: 'northwind',
    title: 'Replay the Northwind webhooks',
    second: 'Tester · Read-only',
    state: 'Failed',
    tone: 'danger',
    scouts: 104,
    costUsd: 10.09,
    startedAt: clock.iso({ at: '2026-10-29T16:10:00.000Z' }),
  },
];
