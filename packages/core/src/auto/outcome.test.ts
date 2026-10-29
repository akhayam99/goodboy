import { describe, expect, it } from 'vitest';
import {
  OUTCOME_MAX_CHARS,
  capOutcomeText,
  outcomeLineOf,
  parseOutcomeLine,
  stripOutcomeLine,
} from './outcome';
import { buildAutoSystemPrompt } from './prompt';
import { composeDelegationKickoff } from './kickoff';
import { READING_ORDER_RULE } from './readingOrderRule';
import type { ResultPublish } from './publish';

const publish = (state: ResultPublish['state'], message: string | null = null): ResultPublish => ({
  mode: 'push',
  state,
  branch: 'ledger-core/retry',
  sha: 'abcdef1234',
  leaseSha: null,
  backupRef: null,
  message,
  isRetryable: false,
  isConfirmed: false,
  tries: 1,
  reviewerReportId: null,
  isContentChanging: false,
});

describe('reading the outcome line of a message', () => {
  it('reads the last outcome block and keeps the rest of the text', () => {
    const text =
      'Notes first.\n<<outcome>>Changes needed: 1 blocker, 4 major.<</outcome>>\nDetails.';
    expect(parseOutcomeLine({ text })).toBe('Changes needed: 1 blocker, 4 major.');
    expect(stripOutcomeLine({ text })).toBe('Notes first.\n\nDetails.');
  });

  it('returns no line when there is no block, an empty one or an open one', () => {
    expect(parseOutcomeLine({ text: 'Plain answer.' })).toBeNull();
    expect(parseOutcomeLine({ text: '<<outcome>>  <</outcome>>' })).toBeNull();
    expect(parseOutcomeLine({ text: 'Text <<outcome>>never closed' })).toBeNull();
    expect(stripOutcomeLine({ text: 'Text <<outcome>>never closed' })).toBe('Text');
  });

  it('flattens lines and caps the text at 100 characters', () => {
    const long = `Updated the retry policy in payments-api ${'and checked it '.repeat(12)}`;
    const line = parseOutcomeLine({ text: `<<outcome>>${long}<</outcome>>` });
    expect(line).not.toBeNull();
    expect(line?.length).toBeLessThanOrEqual(OUTCOME_MAX_CHARS);
    expect(line?.endsWith('...')).toBe(true);
    expect(capOutcomeText({ text: 'a\n  b' })).toBe('a b');
  });
});

describe('the outcome line shown for a result', () => {
  it('keeps the model line when the facts agree', () => {
    expect(
      outcomeLineOf({ modelLine: 'Committed 3 commits, not pushed.', outcome: 'completed' }),
    ).toEqual({ text: 'Committed 3 commits, not pushed.', tone: 'success', source: 'model' });
  });

  it('replaces "Done" with the red checks', () => {
    const line = outcomeLineOf({
      modelLine: 'Done',
      outcome: 'completed',
      checksRun: { verdict: 'red', reason: null, commit: 'abc' },
      checks: [
        { name: 'lint', status: 'fail', source: 'harness' },
        { name: 'test', status: 'fail', source: 'harness' },
        { name: 'build', status: 'pass', source: 'harness' },
      ],
    });
    expect(line).toEqual({ text: 'Checks failed: 2', tone: 'danger', source: 'facts' });
  });

  it('replaces the model line when the push failed', () => {
    const line = outcomeLineOf({
      modelLine: 'Pushed the fix to notify-relay.',
      outcome: 'completed',
      publish: publish('failed', 'the remote rejected it'),
    });
    expect(line?.source).toBe('facts');
    expect(line?.tone).toBe('danger');
    expect(line?.text).toContain('Not pushed');
  });

  it('computes a line from the outcome when the model wrote none', () => {
    expect(outcomeLineOf({ modelLine: null, outcome: 'completed' })).toEqual({
      text: 'Done',
      tone: 'success',
      source: 'facts',
    });
    expect(outcomeLineOf({ modelLine: null, outcome: 'failed', failure: 'process error' })).toEqual(
      {
        text: 'Failed: process error',
        tone: 'danger',
        source: 'facts',
      },
    );
    expect(outcomeLineOf({ modelLine: null, outcome: 'blocked' })?.tone).toBe('warning');
  });

  it('caps a computed line at 100 characters', () => {
    const line = outcomeLineOf({ modelLine: null, outcome: 'failed', failure: 'x'.repeat(300) });
    expect(line?.text.length).toBeLessThanOrEqual(OUTCOME_MAX_CHARS);
  });

  it('returns no line at all when there is no outcome and no model line', () => {
    expect(outcomeLineOf({ modelLine: null, outcome: null })).toBeNull();
    expect(outcomeLineOf({ modelLine: '  ', outcome: null })).toBeNull();
  });
});

describe('the reading order text in prompts', () => {
  it('asks Auto for the outcome line when delegation is on', () => {
    expect(buildAutoSystemPrompt({ isDelegationEnabled: true })).toContain(READING_ORDER_RULE);
    expect(buildAutoSystemPrompt({ isDelegationEnabled: false })).not.toContain(READING_ORDER_RULE);
  });

  it('asks every child for the outcome line in its expected output', () => {
    const text = composeDelegationKickoff({
      role: 'implementer',
      childAgentId: 'agent-1',
      task: 'Fix the retry limit in ledger-core.',
      doneWhen: null,
      expected: null,
      inputs: [],
      revise: null,
      mountLabel: null,
    });
    expect(text).toContain('<<outcome>>');
    expect(text).toContain(`at most ${OUTCOME_MAX_CHARS} characters`);
  });
});
