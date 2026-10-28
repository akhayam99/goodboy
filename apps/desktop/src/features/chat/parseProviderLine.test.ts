import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { parseProviderLine } from './parseProviderLine';

const RUN_ID = brandId<ProviderRunId>({ value: 'run-copilot' });
const AT = brandId<IsoDateTime>({ value: '2026-10-28T00:00:00.000Z' });
const CTX = { runId: RUN_ID, now: () => AT };

describe('parseProviderLine', () => {
  it('reads a copilot reply delta with the copilot parser', () => {
    const line = JSON.stringify({
      type: 'assistant.message_delta',
      data: { messageId: 'm1', deltaContent: 'Hi' },
    });
    expect(parseProviderLine({ provider: 'copilot', line, ctx: CTX })).toEqual([
      { kind: 'assistant_text', runId: RUN_ID, delta: 'Hi', at: AT, isPartial: true },
    ]);
  });

  it('reads a copilot tool call, which no other parser knows', () => {
    const line = JSON.stringify({ type: 'tool.execution_start', data: { toolCallId: 'c1' } });
    const copilot = parseProviderLine({ provider: 'copilot', line, ctx: CTX });
    expect(copilot.map((event) => event.kind)).toEqual(['tool_call_start']);
  });
});
