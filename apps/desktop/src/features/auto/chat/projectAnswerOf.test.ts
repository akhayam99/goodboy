// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { projectAnswerOf } from './projectAnswerOf';

const PAYMENTS = { key: 'payments-api', name: 'payments-api' };
const LEDGER = { key: 'ledger-core', name: 'ledger-core' };
const NOTIFY = { key: 'notify-relay', name: 'notify-relay' };

describe('projectAnswerOf', () => {
  it('asks for a choice until one project is picked', () => {
    expect(projectAnswerOf({ picks: [], roleNoun: 'Implementer' })).toEqual({
      label: 'Choose a folder',
      message: null,
    });
  });

  it('names the one project, both, or the count', () => {
    expect(projectAnswerOf({ picks: [PAYMENTS], roleNoun: 'Implementer' })).toEqual({
      label: 'Use payments-api',
      message: 'Use payments-api for the Implementer.',
    });
    expect(projectAnswerOf({ picks: [PAYMENTS, LEDGER], roleNoun: 'Implementer' })).toEqual({
      label: 'Use both',
      message: 'Use payments-api and ledger-core: start one Implementer per folder.',
    });
    expect(
      projectAnswerOf({ picks: [PAYMENTS, LEDGER, NOTIFY], roleNoun: 'Implementer' }).label,
    ).toBe('Use 3 folders');
  });
});
