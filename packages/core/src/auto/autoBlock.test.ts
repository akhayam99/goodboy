import { describe, expect, it } from 'vitest';
import { parseDelegateSpec } from './delegateSpec';
import { parseAutoBlock } from './autoBlock';

const CHILD = { role: 'scout', task: 'Find the retry limit.', reason: 'Reading code.' };

const block = (json: unknown): string => `<<auto>>${JSON.stringify(json)}<</auto>>`;

describe('parseAutoBlock', () => {
  it('returns none for a plain answer', () => {
    expect(parseAutoBlock({ text: 'The limit is 3 retries, set in ledger-core.' })).toEqual({
      kind: 'none',
    });
    expect(parseAutoBlock({ text: '' })).toEqual({ kind: 'none' });
  });

  it('reads a delegate block with its request id and the children as a spec', () => {
    const outcome = parseAutoBlock({
      text: `I will ask a scout.\n${block({ action: 'delegate', requestId: 'r1', children: [CHILD] })}`,
    });

    expect(outcome.kind).toBe('block');
    if (outcome.kind !== 'block' || outcome.block.action !== 'delegate') {
      throw new Error('expected a delegate block');
    }
    expect(outcome.block.requestId).toBe('r1');
    expect(parseDelegateSpec({ text: outcome.block.spec }).kind).toBe('ok');
  });

  it('leaves the request id empty when none is written, for the caller to derive', () => {
    const outcome = parseAutoBlock({ text: block({ action: 'delegate', children: [CHILD] }) });

    expect(outcome).toMatchObject({
      kind: 'block',
      block: { action: 'delegate', requestId: null },
    });
  });

  it('reads an answer block', () => {
    expect(
      parseAutoBlock({
        text: block({ action: 'answer', delegation: 'd1', question: 'q1', text: 'Use the cache.' }),
      }),
    ).toEqual({
      kind: 'block',
      block: { action: 'answer', delegation: 'd1', question: 'q1', text: 'Use the cache.' },
    });
  });

  it('reads a finish block', () => {
    expect(parseAutoBlock({ text: block({ action: 'finish', summary: 'All done.' }) })).toEqual({
      kind: 'block',
      block: { action: 'finish', summary: 'All done.' },
    });
  });

  it('is invalid for an unknown action, a missing field and a non-object', () => {
    expect(parseAutoBlock({ text: block({ action: 'status' }) }).kind).toBe('invalid');
    expect(parseAutoBlock({ text: block({ action: 'delegate' }) }).kind).toBe('invalid');
    expect(parseAutoBlock({ text: block({ action: 'answer', delegation: 'd1' }) }).kind).toBe(
      'invalid',
    );
    expect(parseAutoBlock({ text: block({ action: 'finish', summary: '  ' }) }).kind).toBe(
      'invalid',
    );
    expect(
      parseAutoBlock({ text: block({ action: 'delegate', requestId: 4, children: [] }) }).kind,
    ).toBe('invalid');
    expect(parseAutoBlock({ text: '<<auto>>[1,2]<</auto>>' }).kind).toBe('invalid');
  });

  it('is invalid for malformed JSON and for an empty or unclosed block with no object', () => {
    expect(parseAutoBlock({ text: '<<auto>>{"action": "delegate", <</auto>>' }).kind).toBe(
      'invalid',
    );
    expect(parseAutoBlock({ text: '<<auto>><</auto>>' }).kind).toBe('invalid');
    expect(parseAutoBlock({ text: 'Working on it <<auto>>' }).kind).toBe('invalid');
  });

  it('takes the last complete block when there are two', () => {
    const text = `${block({ action: 'finish', summary: 'first' })}\nWait, no.\n${block({ action: 'finish', summary: 'second' })}`;

    expect(parseAutoBlock({ text })).toEqual({
      kind: 'block',
      block: { action: 'finish', summary: 'second' },
    });
  });

  it('prefers a complete block over a later unclosed mention', () => {
    const text = `${block({ action: 'finish', summary: 'done' })}\nThe format is <<auto>> then JSON.`;

    expect(parseAutoBlock({ text })).toEqual({
      kind: 'block',
      block: { action: 'finish', summary: 'done' },
    });
  });

  it('ignores text after the block', () => {
    const text = `${block({ action: 'finish', summary: 'done' })}\n\nLet me know if you want more.`;

    expect(parseAutoBlock({ text }).kind).toBe('block');
  });

  it('strips code fences inside the block', () => {
    const text = `<<auto>>\n\`\`\`json\n${JSON.stringify({ action: 'finish', summary: 'ok' })}\n\`\`\`\n<</auto>>`;

    expect(parseAutoBlock({ text }).kind).toBe('block');
  });

  it('escapes raw line breaks inside strings', () => {
    const text = '<<auto>>{"action":"finish","summary":"line one\nline two"}<</auto>>';

    expect(parseAutoBlock({ text })).toMatchObject({
      kind: 'block',
      block: { summary: 'line one\nline two' },
    });
  });

  it('falls back to the last brace when the close marker is missing', () => {
    const text = `<<auto>>${JSON.stringify({ action: 'finish', summary: 'ok' })}\nbye`;

    expect(parseAutoBlock({ text }).kind).toBe('block');
  });
});
