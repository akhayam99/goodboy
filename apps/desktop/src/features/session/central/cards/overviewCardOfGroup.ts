import type { NextGroupId } from '../next/nextGroupIds';

export type NextOverviewCardId = 'needs-you' | 'next';

export const OVERVIEW_CARD_OF_GROUP: Readonly<Record<NextGroupId, NextOverviewCardId>> = {
  decide: 'needs-you',
  fix: 'needs-you',
  update: 'next',
  ship: 'next',
};
