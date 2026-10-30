import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { reduceTranscript } from '../../utils/transcript-items';
import { anchorKeyOf } from './anchorKeyOf';

const RUN = brandId<ProviderRunId>({ value: 'run-auto-1' });
const AT = brandId<IsoDateTime>({ value: '2026-10-30T12:00:00.000Z' });

describe('anchorKeyOf', () => {
  it('anchors a message sent to the Auto agent, stored as operator text', () => {
    const items = reduceTranscript([
      { kind: 'operator_text', runId: RUN, text: 'Also cover refunds.', at: AT },
      {
        kind: 'user_text',
        runId: RUN,
        text: 'MESSAGES FROM THE USER, OLDEST FIRST',
        deliveredBy: 'auto',
        at: AT,
      },
    ]);

    expect(anchorKeyOf({ items })).toBe(items[0]?.key);
  });
});
