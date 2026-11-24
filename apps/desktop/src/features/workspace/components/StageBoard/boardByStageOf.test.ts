// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type SessionId,
  type SessionSortKey,
  type SessionStageInfo,
  type SessionViewPrefs,
} from '@goodboy/types';
import { sessionFixture } from '../../../../__tests__/helpers/actionFixtures';
import { boardByStageOf } from './boardByStageOf';

type SessionParams = {
  readonly id: string;
  readonly goal: string;
  readonly at: string;
};

const sessionOf = ({ id, goal, at }: SessionParams) =>
  sessionFixture({
    id: brandId<SessionId>({ value: id }),
    goal,
    createdAt: brandId<IsoDateTime>({ value: at }),
    updatedAt: brandId<IsoDateTime>({ value: at }),
  });

const approved = sessionOf({ id: 'zebra', goal: 'Zebra rollout', at: '2026-10-07T10:00:00.000Z' });
const reviewing = sessionOf({ id: 'acme', goal: 'Acme refunds', at: '2026-10-07T09:00:00.000Z' });

const INFOS: Readonly<Record<string, SessionStageInfo>> = {
  [approved.id]: {
    stage: 'attention',
    reason: '',
    addsFact: false,
    attention: 'pr-approved',
    prState: 'approved',
  },
  [reviewing.id]: {
    stage: 'review',
    reason: '',
    addsFact: false,
    attention: null,
    prState: 'open',
  },
};

type PrefsParams = {
  readonly sort: SessionSortKey;
};

const prefsOf = ({ sort }: PrefsParams): SessionViewPrefs => ({
  sort,
  group: 'stage',
  isArchivedShown: false,
  isFoldOpen: false,
  statusFilter: [],
});

const GROUPS = [
  { key: 'attention', sessions: [approved] },
  { key: 'review', sessions: [reviewing] },
];

const reviewLaneOf = ({ sort }: PrefsParams) =>
  boardByStageOf({ groups: GROUPS, infos: INFOS, prefs: prefsOf({ sort }) })
    .get('review')
    ?.map((session) => session.goal);

describe('boardByStageOf', () => {
  it('sorts a quiet session into its lane by the chosen order', () => {
    expect(reviewLaneOf({ sort: 'goal' })).toEqual(['Acme refunds', 'Zebra rollout']);
    expect(reviewLaneOf({ sort: 'updatedAt' })).toEqual(['Zebra rollout', 'Acme refunds']);
    expect(reviewLaneOf({ sort: 'createdAt' })).toEqual(['Zebra rollout', 'Acme refunds']);
  });

  it('keeps a quiet session first when the board sorts by what needs you', () => {
    expect(reviewLaneOf({ sort: 'needsYou' })).toEqual(['Zebra rollout', 'Acme refunds']);
  });
});
