import { describe, expect, it } from 'vitest';
import { autoPlanOutlineOf } from './autoPlanOutlineOf';

const PLAN = [
  '# Retry failed charges',
  '',
  '## Approach',
  'Add a backoff in payments-api.',
  '',
  '## Parts',
  '1. Add `src/retry/backoff.ts` with the delay table',
  '2. Wire it into `src/charges/charge.ts`',
  '3. Cover it in `src/retry/backoff.test.ts`',
  '4. Document it',
  '5. Release note',
  '',
  '## Risks',
  '- Duplicate charges on a slow network',
  '- Longer checkout on a retry',
].join('\n');

describe('autoPlanOutlineOf', () => {
  it('reads the first four steps and the counts', () => {
    expect(autoPlanOutlineOf({ sourceText: PLAN })).toEqual({
      steps: [
        'Add src/retry/backoff.ts with the delay table',
        'Wire it into src/charges/charge.ts',
        'Cover it in src/retry/backoff.test.ts',
        'Document it',
      ],
      stepCount: 5,
      fileCount: 3,
      riskCount: 2,
    });
  });

  it('returns null when the plan has no parts', () => {
    expect(autoPlanOutlineOf({ sourceText: '# Plan\n\nJust prose.' })).toBeNull();
  });

  it('stops a section at the next heading of the same level', () => {
    const outline = autoPlanOutlineOf({
      sourceText: '## Parts\n1. one\n## Notes\n2. not a step\n## Risks\n- a',
    });
    expect(outline).toMatchObject({ stepCount: 1, riskCount: 1 });
  });
});
