// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { forgetTerminalCommand, trackTerminalInput } from './commandTracker';
import { terminalCommandOf } from './terminalCommandOf';

const ID = 'session-1::t1';

afterEach(() => forgetTerminalCommand({ terminalId: ID }));

describe('terminalCommandOf', () => {
  it('prefers the foreground process over a command typed earlier and recalled with the arrow', () => {
    trackTerminalInput({ terminalId: ID, data: 'pnpm dev\r' });
    trackTerminalInput({ terminalId: ID, data: '\u001B[A' });
    trackTerminalInput({ terminalId: ID, data: '\r' });

    expect(terminalCommandOf({ terminalId: ID, foregroundCommands: new Map() })).toBe('pnpm dev');
    expect(
      terminalCommandOf({ terminalId: ID, foregroundCommands: new Map([[ID, 'pnpm test']]) }),
    ).toBe('pnpm test');
  });

  it('is empty when nothing was typed and no process is known', () => {
    expect(terminalCommandOf({ terminalId: ID, foregroundCommands: new Map() })).toBeNull();
  });
});
