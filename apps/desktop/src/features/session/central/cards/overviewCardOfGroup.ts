import type { NextGroupId } from '../next/nextGroupIds';

export type NextOverviewCardId = 'needs-you' | 'branches';

export const OVERVIEW_CARD_OF_GROUP: Readonly<Record<NextGroupId, NextOverviewCardId>> = {
  decide: 'needs-you',
  fix: 'needs-you',
  update: 'branches',
  ship: 'branches',
};
