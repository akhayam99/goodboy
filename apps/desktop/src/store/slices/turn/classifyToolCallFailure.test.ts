import { describe, expect, it } from 'vitest';
import { classifyToolCallFailure, toolCallFailureMessage } from './classifyToolCallFailure';

const LOCK_MESSAGE =
  "fatal: Unable to create '/repo/.git/index.lock': File exists.\n\n" +
  'Another git process seems to be running in this repository, e.g.\n' +
  "an editor opened by 'git commit'. Please make sure all processes\n" +
  'are terminated then try again. If it still fails, a git process\n' +
  'may have crashed in this repository earlier:\n' +
  'remove the file manually to continue.';

describe('classifyToolCallFailure', () => {
  it('detects a git index.lock failure from a string output (anthropic, cursor, opencode)', () => {
    expect(classifyToolCallFailure({ output: LOCK_MESSAGE })).toEqual({ kind: 'git_index_lock' });
  });

  it('detects a git index.lock failure from codex structured output', () => {
    expect(
      classifyToolCallFailure({
        output: { aggregated_output: LOCK_MESSAGE, exit_code: 128 },
      }),
    ).toEqual({ kind: 'git_index_lock' });
  });

  it('ignores an unrelated string tool failure', () => {
    expect(classifyToolCallFailure({ output: 'command not found: foo' })).toEqual({
      kind: 'other',
    });
  });

  it('ignores an unrelated codex structured failure', () => {
    expect(
      classifyToolCallFailure({
        output: { aggregated_output: 'npm ERR! missing script: build', exit_code: 1 },
      }),
    ).toEqual({ kind: 'other' });
  });

  it('handles a null output without throwing', () => {
    expect(classifyToolCallFailure({ output: null })).toEqual({ kind: 'other' });
  });

  it('builds an actionable message for the git index.lock case', () => {
    expect(toolCallFailureMessage({ kind: 'git_index_lock' })).toBe(
      'Git could not commit because another process is holding .git/index.lock. Close any other Git client, editor, or terminal running a commit in this repository, then retry.',
    );
  });

  it('returns null for a non-lock classification', () => {
    expect(toolCallFailureMessage({ kind: 'other' })).toBeNull();
  });
});
