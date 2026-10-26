import { describe, expect, it } from 'vitest';
import { brandId } from '@goodboy/types';
import { aSession, nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import type { TerminalTab, TerminalTabId } from '../../shared/types/terminal';
import { ARCHIVED_GROUP_KEY, terminalGroups } from './terminalWorktrees';

const WORKSPACE = nextWorkspaceId();
const OTHER_WORKSPACE = nextWorkspaceId();
const LIVE = aSession({
  id: nextSessionId(),
  workspaceId: WORKSPACE,
  goal: 'Close the ledger month',
});
const ARCHIVED = aSession({
  id: nextSessionId(),
  workspaceId: WORKSPACE,
  goal: 'Retry the webhook',
});
const FOREIGN = aSession({
  id: nextSessionId(),
  workspaceId: OTHER_WORKSPACE,
  goal: 'Northwind export',
});

const tab = (id: string, sessionId: typeof LIVE.id, cwd: string): TerminalTab => ({
  id: brandId<TerminalTabId>({ value: id }),
  owner: { kind: 'session', sessionId },
  title: 'shell',
  cwd,
  status: 'running',
  createdAt: 1,
});

const groupsOf = (archivedSessions: ReadonlyArray<typeof ARCHIVED>) =>
  terminalGroups({
    workspaceId: WORKSPACE,
    terminalTabs: {
      [LIVE.id]: [tab('t-live', LIVE.id, '/repos/ledger-core')],
      [ARCHIVED.id]: [
        tab('t-dev', ARCHIVED.id, '/repos/payments-api/.goodboy/worktrees/retry-webhook'),
        tab('t-test', ARCHIVED.id, '/repos/payments-api/.goodboy/worktrees/retry-webhook'),
      ],
      [FOREIGN.id]: [tab('t-foreign', FOREIGN.id, '/repos/notify-relay')],
    },
    sessions: [LIVE],
    archivedSessions,
    mountsBySession: {},
    projects: [],
  });

describe('terminalGroups', () => {
  it('keeps the shells of an archived session visible in one group of their own', () => {
    const groups = groupsOf([ARCHIVED, FOREIGN]);

    expect(groups.map((group) => group.kind)).toEqual(['session', 'archived']);
    const archived = groups[1]!;
    expect(archived.key).toBe(ARCHIVED_GROUP_KEY);
    expect(archived.title).toBe('Archived sessions');
    expect(archived.worktrees).toHaveLength(1);
    expect(archived.worktrees[0]?.tabs.map((entry) => entry.id)).toEqual(['t-dev', 't-test']);
    expect(archived.worktrees[0]?.sessionId).toBe(ARCHIVED.id);
  });

  it('adds no archived group when no archived session has a shell', () => {
    expect(groupsOf([]).map((group) => group.kind)).toEqual(['session']);
    expect(groupsOf([FOREIGN]).map((group) => group.kind)).toEqual(['session']);
  });
});
