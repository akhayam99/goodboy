// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { TerminalTab, TerminalTabId } from '../../shared/types/terminal';
import { brandedId } from '../history/testing/brandedId';
import { runningTerminalCount } from './runningTerminalCount';

type TabParams = {
  readonly id: string;
  readonly status: TerminalTab['status'];
};

const tabOf = ({ id, status }: TabParams) =>
  ({
    id: brandedId<TerminalTabId>({ value: id }),
    owner: { kind: 'session', sessionId: brandedId<SessionId>({ value: 'session-1' }) },
    title: id,
    cwd: null,
    status,
    createdAt: 0,
  }) satisfies TerminalTab;

describe('runningTerminalCount', () => {
  it('counts live tabs of every owner and skips exited ones', () => {
    expect(
      runningTerminalCount({
        tabs: {
          one: [tabOf({ id: 'a', status: 'running' }), tabOf({ id: 'b', status: 'exited' })],
          two: [tabOf({ id: 'c', status: 'attention' })],
        },
      }),
    ).toBe(2);
  });

  it('is zero with no tab', () => {
    expect(runningTerminalCount({ tabs: {} })).toBe(0);
  });
});
