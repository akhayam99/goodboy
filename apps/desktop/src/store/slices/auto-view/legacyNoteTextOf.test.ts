import { describe, expect, it } from 'vitest';
import { legacyNoteTextOf } from './legacyNoteTextOf';

describe('legacyNoteTextOf', () => {
  it.each([
    'Permission for Read is granted for this one call.',
    'Permission for Grep is now granted.\nRetry the tool call that was blocked, then continue where you stopped.',
    'Permission for that exact command is granted for this one call. Continue where you stopped.',
    'Denied Grep for this one call. Do not run it; carry on another way, or say what you need.',
    'Continue from where you stopped.',
    'Continue the agent that stopped from where it left off.',
    'Continue the Implementer that stopped (delegation d-1) from where it left off.',
    'Continue the Implementer that stopped (delegation d-1) from where it left off: patch ledger-core',
    '<<oq-answers>>\nAnswers to open questions:\n<</oq-answers>>',
  ])('reads %j as no note', (text) => {
    expect(legacyNoteTextOf({ text })).toBeNull();
  });

  it('strips the lines of held answers and keeps the words after them', () => {
    const text = [
      'Permission for Read is granted for this one call.',
      'Permission for Bash is now granted.',
      'Rename the guard in notify-relay',
    ].join('\n');

    expect(legacyNoteTextOf({ text })).toBe('Rename the guard in notify-relay');
  });

  it('keeps the reason after Denied and nothing before it', () => {
    expect(legacyNoteTextOf({ text: 'Denied Read and Grep. use the Northwind fixtures' })).toBe(
      'use the Northwind fixtures',
    );
  });

  it('keeps the words that follow a denial notice', () => {
    const text =
      'Denied Read for this one call. Do not run it; carry on another way, or say what you need.\n\nship it on Friday';

    expect(legacyNoteTextOf({ text })).toBe('ship it on Friday');
  });

  it('keeps a human sentence untouched', () => {
    expect(legacyNoteTextOf({ text: 'Continue with the Acme import after lunch' })).toBe(
      'Continue with the Acme import after lunch',
    );
  });
});
