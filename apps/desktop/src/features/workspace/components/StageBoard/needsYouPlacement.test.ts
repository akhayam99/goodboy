// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type SessionAttentionReason,
  type SessionId,
  type SessionStageInfo,
  type SessionViewPrefs,
} from '@goodboy/types';
import { sessionFixture } from '../../../../__tests__/helpers/actionFixtures';
import { ATTENTION_REASON_META } from '../../../session/session-stage';
import { needsYouOf } from '../../../board/needsYou/needsYouOf';
import { boardByStageOf } from './boardByStageOf';

const AT = brandId<IsoDateTime>({ value: '2026-10-07T09:00:00.000Z' });

const PREFS: SessionViewPrefs = {
  sort: 'updatedAt',
  group: 'stage',
  isArchivedShown: false,
  isFoldOpen: false,
  statusFilter: [],
};

const REASONS = Object.keys(ATTENTION_REASON_META).filter(
  (key): key is SessionAttentionReason => key in ATTENTION_REASON_META,
);

type ReasonParams = {
  readonly reason: SessionAttentionReason;
};

const placementOf = ({ reason }: ReasonParams) => {
  const session = sessionFixture({
    id: brandId<SessionId>({ value: `session-${reason}` }),
    goal: 'Reconcile the settlement export',
    createdAt: AT,
    updatedAt: AT,
  });
  const info: SessionStageInfo = {
    stage: 'attention',
    reason: '',
    addsFact: false,
    attention: reason,
    prState: reason === 'pr-approved' || reason === 'pr-queued' ? 'approved' : null,
  };
  const infos = { [session.id]: info };
  const lanes = boardByStageOf({
    groups: [{ key: 'attention', sessions: [session] }],
    infos,
    prefs: PREFS,
  });
  const laneKeys = [...lanes.entries()]
    .filter(([, sessions]) => sessions.some((candidate) => candidate.id === session.id))
    .map(([key]) => key);
  const cards = needsYouOf({ sessions: [session], infos, openQuestions: {} }).cards;
  return { laneKeys, cardCount: cards.length };
};

const isLoud = ({ reason }: ReasonParams): boolean => {
  const { tone } = ATTENTION_REASON_META[reason];
  return tone === 'warning' || tone === 'danger';
};

describe('where a session that waits on the owner sits on the Board', () => {
  it.each(REASONS.filter((reason) => isLoud({ reason })))(
    'puts a %s session in Running as one needs you card and in no other lane',
    (reason) => {
      expect(placementOf({ reason })).toEqual({ laneKeys: [], cardCount: 1 });
    },
  );

  it.each(REASONS.filter((reason) => !isLoud({ reason })))(
    'keeps a quiet %s session as a plain card in its own lane',
    (reason) => {
      const placed = placementOf({ reason });
      expect(placed.cardCount).toBe(0);
      expect(placed.laneKeys).toHaveLength(1);
    },
  );
});
