// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checksSkippedLine, checksSkippedOf, isMissingDepsReason } from './checksSkipped';

describe('checksSkippedOf', () => {
  it('reads the reason the agent gave for checks that did not run', () => {
    const text =
      "Committed as `90b1d57f1`. eslint and tsc didn't run because deps aren't installed in this copy, so the change is checked only by prettier and grep. The extra passes were not run.";

    const skipped = checksSkippedOf({ text });

    expect(skipped).toEqual({ reason: "deps aren't installed in this copy" });
    expect(skipped === null ? '' : checksSkippedLine({ skipped })).toBe(
      "Checks were skipped: deps aren't installed in this copy",
    );
  });

  it('accepts a curly apostrophe and another wording', () => {
    expect(checksSkippedOf({ text: 'The tests couldn’t run, vitest is missing.' })).toEqual({
      reason: "The tests couldn't run, vitest is missing",
    });
    expect(checksSkippedOf({ text: 'Typecheck was skipped.' })).toEqual({
      reason: 'Typecheck was skipped',
    });
  });

  it('stays quiet when the checks ran or the agent says nothing about them', () => {
    expect(checksSkippedOf({ text: 'I ran eslint and tsc, both pass.' })).toBeNull();
    expect(checksSkippedOf({ text: 'The build did not fail.' })).toBeNull();
    expect(checksSkippedOf({ text: 'The two bots were not run.' })).toBeNull();
    expect(checksSkippedOf({ text: '' })).toBeNull();
  });
});

describe('isMissingDepsReason', () => {
  it('recognises a reason that points at missing dependencies', () => {
    expect(isMissingDepsReason({ reason: "deps aren't installed in this copy" })).toBe(true);
    expect(isMissingDepsReason({ reason: 'node_modules is missing' })).toBe(true);
    expect(isMissingDepsReason({ reason: 'the dependencies could not be resolved' })).toBe(true);
  });

  it('leaves other reasons alone', () => {
    expect(isMissingDepsReason({ reason: 'the runner timed out' })).toBe(false);
    expect(isMissingDepsReason({ reason: 'you asked me to skip them' })).toBe(false);
  });
});
