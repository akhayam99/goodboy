import { describe, expect, it } from 'vitest';
import type { TerminalTab } from '../../shared/types/terminal';
import { parseTerminalId, terminalTabIdOf } from '../../store/slices/terminal/terminalOwner';
import { worktreePorts } from './worktreePorts';

const parsed = parseTerminalId({ id: 'session-1::t1' });
if (parsed === null) {
  throw new Error('fixture id must parse');
}
const { owner } = parsed;

const tabOf = (ordinal: number): TerminalTab => ({
  id: terminalTabIdOf({ owner, ordinal }),
  owner,
  title: 'Terminal',
  cwd: '/worktrees/payments-api',
  status: 'running',
  createdAt: 0,
});

describe('worktreePorts', () => {
  it('sums the ports of every tab once, sorted', () => {
    const tabs = [tabOf(1), tabOf(2), tabOf(3)];
    const portsByTerminal = new Map<string, ReadonlyArray<number>>([
      [tabs[0]?.id ?? '', [5173, 3000]],
      [tabs[1]?.id ?? '', [3000, 8080]],
    ]);

    expect(worktreePorts({ tabs, portsByTerminal })).toEqual([3000, 5173, 8080]);
  });

  it('is empty when no tab listens', () => {
    expect(worktreePorts({ tabs: [tabOf(1)], portsByTerminal: new Map() })).toEqual([]);
  });
});
