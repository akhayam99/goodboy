import { afterEach, describe, expect, it } from 'vitest';
import { forgetTerminalCommand, lastCommandOf, trackTerminalInput } from './commandTracker';

const ID = 'session-1::t1';

afterEach(() => forgetTerminalCommand({ terminalId: ID }));

describe('commandTracker', () => {
  it('remembers the line sent with enter', () => {
    trackTerminalInput({ terminalId: ID, data: 'pnpm dev' });
    trackTerminalInput({ terminalId: ID, data: '\r' });

    expect(lastCommandOf({ terminalId: ID })).toBe('pnpm dev');
  });

  it('applies backspace and ignores escape sequences', () => {
    trackTerminalInput({ terminalId: ID, data: 'pnpm devx\u007f' });
    trackTerminalInput({ terminalId: ID, data: '\u001b[A' });
    trackTerminalInput({ terminalId: ID, data: '\r' });

    expect(lastCommandOf({ terminalId: ID })).toBe('pnpm dev');
  });

  it('keeps the previous command across a blank line', () => {
    trackTerminalInput({ terminalId: ID, data: 'ls\r' });
    trackTerminalInput({ terminalId: ID, data: '   \r' });

    expect(lastCommandOf({ terminalId: ID })).toBe('ls');
  });

  it('forgets a closed terminal', () => {
    trackTerminalInput({ terminalId: ID, data: 'ls\r' });
    forgetTerminalCommand({ terminalId: ID });

    expect(lastCommandOf({ terminalId: ID })).toBeNull();
  });
});
