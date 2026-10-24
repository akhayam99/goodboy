import { describe, expect, it } from 'vitest';
import { changeDirectoryInput } from './changeDirectoryInput';

const KILL_LINE = '\x05\x15';

describe('changeDirectoryInput', () => {
  it('clears whatever is typed on the prompt before the cd, and presses Enter after it', () => {
    expect(changeDirectoryInput({ path: '/repos/notify-relay' })).toBe(
      `${KILL_LINE}cd '/repos/notify-relay'\r`,
    );
  });

  it('never leaves the cd glued to a half-typed command', () => {
    const input = changeDirectoryInput({ path: '/repos/ledger-core' });

    expect(input.indexOf(KILL_LINE)).toBe(0);
    expect(input.indexOf('cd ')).toBe(KILL_LINE.length);
  });

  it('quotes a folder with a space or an apostrophe so the shell reads one word', () => {
    expect(changeDirectoryInput({ path: "/repos/Harborline's ledger" })).toBe(
      `${KILL_LINE}cd '/repos/Harborline'\\''s ledger'\r`,
    );
  });
});
