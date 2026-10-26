import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId, type TurnEvent } from '@goodboy/types';
import { lastAssistantMessage } from './lastAssistantMessage';

const FIRST_AT = brandId<IsoDateTime>({ value: '2026-10-10T09:00:00.000Z' });
const SECOND_AT = brandId<IsoDateTime>({ value: '2026-10-10T09:05:00.000Z' });
const LAST_AT = brandId<IsoDateTime>({ value: '2026-10-10T09:10:00.000Z' });

type TurnParams = {
  readonly runId: string;
  readonly delta: string;
  readonly at: IsoDateTime;
};

const assistantTurn = ({ runId, delta, at }: TurnParams): TurnEvent => ({
  kind: 'assistant_text',
  runId: brandId<ProviderRunId>({ value: runId }),
  delta,
  at,
});

describe('lastAssistantMessage', () => {
  it('answers null when the agent never spoke', () => {
    expect(lastAssistantMessage({ events: [] })).toBeNull();
  });

  it('joins the deltas of the last run and trims them', () => {
    const message = lastAssistantMessage({
      events: [
        assistantTurn({ runId: 'run-ledger-1', delta: 'old answer', at: FIRST_AT }),
        assistantTurn({ runId: 'run-ledger-2', delta: '  Posted ', at: SECOND_AT }),
        assistantTurn({ runId: 'run-ledger-2', delta: 'the batch.\n', at: LAST_AT }),
      ],
    });

    expect(message?.text).toBe('Posted the batch.');
  });

  it('stamps the message with the time of its last event', () => {
    const message = lastAssistantMessage({
      events: [
        assistantTurn({ runId: 'run-ledger-2', delta: 'Posted ', at: SECOND_AT }),
        assistantTurn({ runId: 'run-ledger-2', delta: 'the batch.', at: LAST_AT }),
      ],
    });

    expect(message?.at).toBe(LAST_AT);
  });

  it('answers null when the last run said only blanks', () => {
    expect(
      lastAssistantMessage({
        events: [
          assistantTurn({ runId: 'run-ledger-1', delta: 'old answer', at: FIRST_AT }),
          assistantTurn({ runId: 'run-ledger-2', delta: '   ', at: LAST_AT }),
        ],
      }),
    ).toBeNull();
  });
});
