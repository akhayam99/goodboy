// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { commandTerminalLabel } from './commandTerminalLabel';

const DETECTED = [
  { id: 'terminal', label: 'Terminal.app', canRunCommand: true },
  { id: 'iterm', label: 'iTerm', canRunCommand: true },
  { id: 'warp', label: 'Warp', canRunCommand: false },
];

describe('commandTerminalLabel', () => {
  it('names the terminal app chosen in Open with when it can take a command', () => {
    expect(commandTerminalLabel({ saved: 'iterm', detected: DETECTED })).toBe('iTerm');
  });

  it('names Terminal.app when nothing is chosen or the chosen one cannot take a command', () => {
    expect(commandTerminalLabel({ saved: undefined, detected: DETECTED })).toBe('Terminal.app');
    expect(commandTerminalLabel({ saved: 'warp', detected: DETECTED })).toBe('Terminal.app');
    expect(commandTerminalLabel({ saved: 'iterm', detected: [] })).toBe('Terminal.app');
  });
});
