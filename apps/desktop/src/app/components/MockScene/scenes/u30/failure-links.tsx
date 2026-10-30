import type { ComponentType } from 'react';
import { C07AutoFrame } from '../u25/c07/C07AutoFrame';
import type { C07Seed } from '../u25/c07/c07AutoSeed';
import { C09OrchestratedScene } from '../u25/C09OrchestratedScene';

const LONG_REASON =
  'Auto stopped answering before it replied, twice in a row, while it was checking the retry ledger in payments-api against the Northwind export and waiting on the notify-relay queue to drain.';

const BLOCKED_LONG: C07Seed = { state: 'blocked', place: 'auto', blockedReason: LONG_REASON };

export const U30_FAILURE_LINKS_SCENES = {
  'u30-failure-reason': () => <C07AutoFrame seed={BLOCKED_LONG} />,
  'u30-human-call': () => <C09OrchestratedScene state="blocked" page="document" />,
} satisfies Readonly<Record<string, ComponentType>>;
