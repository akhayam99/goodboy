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

describe('run recap: reading the text a finished run keeps', () => {
  it('reads what is done and what is left from the saved recap', () => {
    const text = serializeRunSummary({
      kind: 'structured',
      done: ['retried the failed payment in ledger-core'],
      left: ['notify-relay still needs the new template'],
      leftRoles: {},
    });

    expect(parseRunSummaryText(text)).toEqual({
      kind: 'structured',
      done: ['retried the failed payment in ledger-core'],
      left: ['notify-relay still needs the new template'],
      leftRoles: {},
    });
  });

  it('returns null for a plain sentence so the recap shows as written', () => {
    expect(parseRunSummaryText('Retried the payment and updated the docs.')).toBeNull();
  });

  it('returns null for text that looks like JSON but is not', () => {
    expect(parseRunSummaryText('{"done": [')).toBeNull();
    expect(parseRunSummaryText('{"unrelated": true}')).toBeNull();
  });

  it('drops blank entries from the saved recap', () => {
    expect(parseRunSummaryText('{"done":["  ","wrote the notes"],"left":[""]}')).toEqual({
      kind: 'structured',
      done: ['wrote the notes'],
      left: [],
      leftRoles: {},
    });
  });
});
