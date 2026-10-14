import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';
import { TEST_NOW } from '@goodboy/types/testing';
import { commitOf } from './commitOf';

const runId: ProviderRunId = JSON.parse(JSON.stringify('run-1'));
const at: IsoDateTime = TEST_NOW;

type CallParams = {
  readonly command: string;
  readonly output: string;
  readonly isError?: boolean;
};

const call = ({ command, output, isError = false }: CallParams): ReadonlyArray<TurnEvent> => [
  { kind: 'tool_call_start', runId, toolUseId: 't1', toolName: 'Bash', input: { command }, at },
  { kind: 'tool_call_end', runId, toolUseId: 't1', output, isError, at },
];

describe('commitOf', () => {
  it('reads the bracketed line of a chatty commit', () => {
    const events = call({
      command: 'git commit -m fix',
      output: '[acme/fix-credits 9e4c1a7] fix\n 1 file changed',
    });
    expect(commitOf({ events })).toBe('9e4c1a7');
  });
  it('reads the oneline of a quiet commit chained with git log', () => {
    const events = call({
      command: 'git commit -qam "Guard the retry" && git log --oneline -1',
      output: '9e4c1a7 Guard the retry\n',
    });
    expect(commitOf({ events })).toBe('9e4c1a7');
  });
  it('keeps the last commit when the fix made two', () => {
    const events = [
      ...call({ command: 'git commit -qam one && git log --oneline -1', output: '1111111 one' }),
      ...call({
        command: 'git commit -qam two && git log --oneline -1',
        output: '2222222 two',
      }).map((event) => ({ ...event, toolUseId: 't2' })),
    ];
    expect(commitOf({ events })).toBe('2222222');
  });
  it('ignores a failed commit and a call that is not a commit', () => {
    expect(
      commitOf({
        events: call({ command: 'git commit -qam x', output: '9e4c1a7 x', isError: true }),
      }),
    ).toBeNull();
    expect(
      commitOf({ events: call({ command: 'git log --oneline -1', output: '9e4c1a7 x' }) }),
    ).toBeNull();
  });
  it('finds nothing in quiet output without a hash', () => {
    expect(commitOf({ events: call({ command: 'git commit -qam x', output: '' }) })).toBeNull();
  });
});
