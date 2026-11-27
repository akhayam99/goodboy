import { describe, expect, it } from 'vitest';
import { parseChildClosing } from './closing';
import {
  closingAfterNudge,
  composeCloseNudgeKickoff,
  isCloseNudgeDue,
  missedClosingOf,
} from './closeNudge';

const ID = 'agent-tester-1';

const closingOf = (text: string) => parseChildClosing({ text, childAgentId: ID });

describe('isCloseNudgeDue', () => {
  it('is due only for a turn that ended ok without a closing', () => {
    expect(isCloseNudgeDue({ exit: 'ok', reason: 'no_closing_envelope' })).toBe(true);
    expect(isCloseNudgeDue({ exit: 'ok', reason: 'report_missing' })).toBe(false);
    expect(isCloseNudgeDue({ exit: 'ok', reason: null })).toBe(false);
    expect(isCloseNudgeDue({ exit: 'error', reason: 'no_closing_envelope' })).toBe(false);
    expect(isCloseNudgeDue({ exit: 'cancelled', reason: 'no_closing_envelope' })).toBe(false);
  });
});

describe('composeCloseNudgeKickoff', () => {
  it('asks for the closing block of this helper and says it is the only reminder', () => {
    const text = composeCloseNudgeKickoff({ role: 'tester', childAgentId: ID });
    expect(text).toContain(`<<step-done id="${ID}">>`);
    expect(text).toContain(`<<step-done id="${ID}" status="returned" needs="shell">>`);
    expect(text).toContain('This is the only reminder.');
    expect(text).toContain('Do not start new work.');
  });

  it('stays short for a helper that kept its session', () => {
    expect(composeCloseNudgeKickoff({ role: 'tester', childAgentId: ID }).length).toBeLessThan(900);
  });

  it('asks a reading role for the report Goodboy did not save', () => {
    const scout = composeCloseNudgeKickoff({ role: 'scout', childAgentId: ID });
    const tester = composeCloseNudgeKickoff({ role: 'tester', childAgentId: ID });
    expect(scout).toContain('<<artifact v=1 kind=report>>');
    expect(tester).not.toContain('<<artifact');
  });

  it('asks a scribe for the pull request blocks again', () => {
    const scribe = composeCloseNudgeKickoff({ role: 'scribe', childAgentId: ID });
    expect(scribe).toContain('<<pr-title>>');
    expect(scribe).toContain('<<pr-body>>');
  });

  it('hands the brief and where it stopped to a helper that lost its session', () => {
    const text = composeCloseNudgeKickoff({
      role: 'tester',
      childAgentId: ID,
      memory: { brief: '**Task** test the ledger export', tail: 'Ran two tests of ledger-core.' },
    });
    expect(text).toContain('**Task** test the ledger export');
    expect(text).toContain('**Where you stopped** Ran two tests of ledger-core.');
  });
});

describe('missedClosingOf', () => {
  it('reads a turn that never closed with the report it did give', () => {
    expect(missedClosingOf({ summary: 'Added two tests to ledger-core.' })).toMatchObject({
      completion: 'none',
      returned: null,
      question: null,
      summary: 'Added two tests to ledger-core.',
    });
  });
});

describe('closingAfterNudge', () => {
  it('keeps what the helper reported before the reminder', () => {
    const closing = closingAfterNudge({
      closing: closingOf(`All green.\n<<step-done id="${ID}">>`),
      earlier: 'Added two tests to ledger-core.',
    });
    expect(closing.completion).toBe('done');
    expect(closing.summary).toBe('Added two tests to ledger-core.\n\nAll green.');
  });

  it('keeps the earlier report when the reply is only the closing line', () => {
    const closing = closingAfterNudge({
      closing: closingOf(`<<step-done id="${ID}">>`),
      earlier: 'Added two tests to ledger-core.',
    });
    expect(closing.summary).toBe('Added two tests to ledger-core.');
  });

  it('stays within the report cap', () => {
    const closing = closingAfterNudge({
      closing: closingOf(`${'b'.repeat(3_900)}\n<<step-done id="${ID}">>`),
      earlier: 'a'.repeat(3_900),
    });
    expect(closing.summary.length).toBeLessThanOrEqual(4_000);
  });
});
