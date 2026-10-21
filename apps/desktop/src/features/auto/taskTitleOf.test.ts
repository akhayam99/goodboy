import { describe, expect, it } from 'vitest';
import { taskTitleOf } from './taskTitleOf';

describe('taskTitleOf', () => {
  it('keeps the first eight words of the title Auto gave', () => {
    expect(
      taskTitleOf({
        request: { title: 'Review the retry fix in payments-api and ledger-core today' },
      }),
    ).toBe('Review the retry fix in payments-api and ledger-core');
  });

  it('falls back to the first sentence of the task, cut at the end of a word', () => {
    expect(
      taskTitleOf({ request: { task: 'Find where the retry limit is set. Report it.' } }),
    ).toBe('Find where the retry limit is set');
    expect(
      taskTitleOf({
        request: {
          task: 'Goal:\n- Move every notify-relay retry into the shared ledger-core queue and keep the order',
        },
      }),
    ).toBe('Move every notify-relay retry into the shared ledger-core…');
  });

  it('gives nothing for an old row with no title and no task', () => {
    expect(taskTitleOf({ request: {} })).toBeNull();
    expect(taskTitleOf({ request: { title: 7, task: '  ' } })).toBeNull();
  });
});
