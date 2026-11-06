// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseGeneratedTitle } from './parseGeneratedTitle';

const ASK = 'Fix the ledger export so it finishes in under five seconds';
const DERIVED = 'fix ledger export';

const parse = (result: string, ask = ASK): string =>
  parseGeneratedTitle({ providerId: 'anthropic', stdout: JSON.stringify({ result }), ask });

describe('parseGeneratedTitle', () => {
  it('reads the title inside the tag', () => {
    expect(parse('<title>Speed up the ledger export</title>')).toBe('Speed up the ledger export');
  });

  it('reads the tag even when the model talks around it', () => {
    expect(parse('Sure.\n<title>Block double credits</title>\nDone.')).toBe('Block double credits');
  });

  it('caps a tagged title at six words', () => {
    expect(parse('<title>Fix the flaky summarizer parser regression now</title>')).toBe(
      'Fix the flaky summarizer parser regression',
    );
  });

  it('unwraps a cursor stream-json result line', () => {
    const stdout = JSON.stringify({
      type: 'result',
      subtype: 'success',
      result: '<title>Add slot retry</title>',
    });

    expect(parseGeneratedTitle({ providerId: 'cursor', stdout, ask: ASK })).toBe('Add slot retry');
  });

  it.each([
    ['no tag', 'Speed up the ledger export'],
    ['an empty tag', '<title></title>'],
    ['a blank tag', '<title>   </title>'],
    ['an unclosed tag', '<title>Speed up the ledger export'],
    ['a nested open tag', '<title>Speed <title>up</title>'],
    ['an empty reply', ''],
  ])('uses the title derived from the goal on %s', (_name, reply) => {
    expect(parse(reply)).toBe(DERIVED);
  });

  it.each([
    'Il titolo è in italiano, quindi',
    'Title generation',
    'ruolo: title only. task richiede lavoro',
    'Auto routed to Claude Haiku',
  ])('rejects the phrase "%s" as a title', (phrase) => {
    expect(parse(`<title>${phrase}</title>`)).toBe(DERIVED);
    expect(parse(phrase)).toBe(DERIVED);
  });

  it('rejects a tag that holds a leaked sentence', () => {
    expect(parse('<title>the user asked for a ledger export that is faster</title>')).toBe(DERIVED);
  });

  it('stays linear on a long run of open tags', () => {
    const reply = '<title>'.repeat(20_000);
    const startedAt = performance.now();

    expect(parse(reply)).toBe(DERIVED);
    expect(performance.now() - startedAt).toBeLessThan(750);
  });
});
