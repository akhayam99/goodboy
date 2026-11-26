import { brandId } from '@goodboy/types';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import type { TerminalTab } from '../../../shared/types/terminal';
import { hasTerminalActivityOf } from './hasTerminalActivityOf';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const OTHER = brandId<SessionId>({ value: 'session-northwind' });
const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-acme' });

const tab = ({ status }: Pick<TerminalTab, 'status'>): TerminalTab => ({
  id: brandId({ value: 'tab-1' }),
  owner: { kind: 'session', sessionId: SESSION },
  title: 'pnpm dev',
  cwd: '~/code/harborline',
  status,
  createdAt: 0,
});

const stateOf = ({
  tabs,
}: {
  readonly tabs: Readonly<Record<string, ReadonlyArray<TerminalTab>>>;
}) => ({
  terminalTabs: tabs,
  terminalFinishes: {},
  currentSessionId: SESSION,
  currentWorkspaceId: WORKSPACE,
});

describe('terminal activity', () => {
  it('counts a tab of this session that needs attention', () => {
    expect(
      hasTerminalActivityOf({
        state: stateOf({ tabs: { [SESSION]: [tab({ status: 'attention' })] } }),
      }),
    ).toBe(true);
  });

  it('ignores a tab of another session that needs attention', () => {
    expect(
      hasTerminalActivityOf({
        state: stateOf({ tabs: { [OTHER]: [tab({ status: 'attention' })] } }),
      }),
    ).toBe(false);
  });

  it('ignores a running tab', () => {
    expect(
      hasTerminalActivityOf({
        state: stateOf({ tabs: { [SESSION]: [tab({ status: 'running' })] } }),
      }),
    ).toBe(false);
  });
});
