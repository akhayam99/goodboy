import { describe, expect, it } from 'vitest';
import { parseRunSummaryText, serializeRunSummary } from './runSummary';

describe('run summary planned roles', () => {
  it('round trips a planned role and keeps plain entries as strings', () => {
    const text = serializeRunSummary({
      kind: 'structured',
      done: ['batched the reads'],
      left: ['prove the batching', 'write the notes'],
      leftRoles: { 'prove the batching': 'tester' },
    });

    expect(JSON.parse(text)).toEqual({
      done: ['batched the reads'],
      left: [{ text: 'prove the batching', role: 'tester' }, 'write the notes'],
    });
    expect(parseRunSummaryText(text)).toEqual({
      kind: 'structured',
      done: ['batched the reads'],
      left: ['prove the batching', 'write the notes'],
      leftRoles: { 'prove the batching': 'tester' },
    });
  });

  it('reads a summary saved before roles with no planned roles', () => {
    expect(parseRunSummaryText('{"done":[],"left":["stream rows"]}')).toEqual({
      kind: 'structured',
      done: [],
      left: ['stream rows'],
      leftRoles: {},
    });
  });
});
