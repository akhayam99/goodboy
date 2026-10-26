import { describe, expect, it } from 'vitest';
import { authReasonSentence } from './authReasonSentence';
import type { AuthReason } from './providers';

type Case = readonly [AuthReason, string];

const CASES: readonly Case[] = [
  [{ kind: 'timed_out', secs: 10 }, "The CLI didn't answer in 10 s"],
  [{ kind: 'timed_out', secs: 15 }, "The CLI didn't answer in 15 s"],
  [{ kind: 'not_installed' }, "The CLI isn't installed"],
  [{ kind: 'spawn_failed', detail: 'permission denied' }, 'permission denied'],
  [{ kind: 'cli_said', detail: 'whatever new wording' }, 'whatever new wording'],
  [{ kind: 'printed_nothing' }, 'The CLI printed nothing'],
  [{ kind: 'exited_with_code', code: 2 }, 'The CLI exited with code 2'],
  [{ kind: 'no_exit_code' }, 'The CLI ended without an exit code'],
  [{ kind: 'empty_command' }, 'The check had no command to run'],
  [{ kind: 'no_access_token' }, 'Cursor holds no access token'],
  [{ kind: 'not_confirmed_by_server' }, "Cursor didn't confirm the account with its server"],
  [{ kind: 'no_status' }, 'The CLI gave no status'],
  [{ kind: 'unknown_provider' }, 'Unknown provider'],
  [{ kind: 'check_unfinished' }, "The check didn't finish"],
];

describe('authReasonSentence', () => {
  it.each(CASES)('writes %j as one sentence', (reason, sentence) => {
    expect(authReasonSentence({ reason })).toBe(sentence);
  });

  it('takes the seconds from the payload, never from a constant', () => {
    expect(authReasonSentence({ reason: { kind: 'timed_out', secs: 7 } })).toContain('7 s');
    expect(authReasonSentence({ reason: { kind: 'timed_out', secs: 7 } })).not.toContain('10');
  });
});
