// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type SessionId, type SessionStageInfo } from '@goodboy/types';
import { sessionFixture } from '../../../__tests__/helpers/actionFixtures';
import { readyToMergeOf } from './readyToMergeOf';

const approved: SessionStageInfo = {
  stage: 'attention',
  reason: '',
  addsFact: false,
  attention: 'pr-approved',
  attentionSince: 1_000,
  prState: null,
};

const HARBORLINE = sessionFixture({ id: brandId<SessionId>({ value: 'harborline-payouts' }) });
const NORTHWIND = sessionFixture({ id: brandId<SessionId>({ value: 'northwind-ledger' }) });
const ACME = sessionFixture({ id: brandId<SessionId>({ value: 'acme-notify' }) });

describe('readyToMergeOf', () => {
  it('lists an approved pull request only once its checks are green', () => {
    const rows = readyToMergeOf({
      sessions: [HARBORLINE, NORTHWIND, ACME],
      infos: {
        [HARBORLINE.id]: approved,
        [NORTHWIND.id]: { ...approved, otherReasons: ['ci-failed'] },
        [ACME.id]: approved,
      },
      numbers: { [HARBORLINE.id]: 41, [NORTHWIND.id]: 42, [ACME.id]: 43 },
      checks: { [HARBORLINE.id]: 'success', [NORTHWIND.id]: 'failure', [ACME.id]: 'pending' },
    });
    expect(rows).toEqual([{ sessionId: HARBORLINE.id, number: 41 }]);
  });
});
