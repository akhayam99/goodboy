import { brandId, type SessionId } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import type { TerminalTab, TerminalTabId } from '../../shared/types/terminal';
import { elsewhereNoteOf, elsewhereShellsOf } from './elsewhereShellsOf';
import type { TerminalGroup } from './terminalWorktrees';

const LEDGER = brandId<SessionId>({ value: 'session-ledger-core' });
const RELAY = brandId<SessionId>({ value: 'session-notify-relay' });

const tabOf = ({
  id,
  status,
}: {
  readonly id: string;
  readonly status: TerminalTab['status'];
}): TerminalTab => ({
  id: brandId<TerminalTabId>({ value: id }),
  owner: { kind: 'session', sessionId: LEDGER },
  title: 'pnpm dev',
  cwd: '/work/ledger-core',
  status,
  createdAt: 0,
});

const groupOf = ({
  sessionId,
  tabs,
}: {
  readonly sessionId: SessionId;
  readonly tabs: ReadonlyArray<TerminalTab>;
}): TerminalGroup => ({
  key: sessionId,
  kind: 'session',
  sessionId,
  title: 'Retry the webhook',
  worktrees: [
    {
      key: `${sessionId}:wt`,
      kind: 'mount',
      sessionId,
      projectId: null,
      projectName: 'ledger-core',
      branch: 'ak/retry-budget',
      path: '/work/ledger-core',
      folder: 'ledger-core',
      tabs,
    },
  ],
});

describe('the shells running in other sessions', () => {
  it('counts the running shells of every session but the one shown', () => {
    const groups = [
      groupOf({ sessionId: LEDGER, tabs: [tabOf({ id: 'a', status: 'running' })] }),
      groupOf({
        sessionId: RELAY,
        tabs: [tabOf({ id: 'b', status: 'running' }), tabOf({ id: 'c', status: 'exited' })],
      }),
    ];

    expect(elsewhereNoteOf({ shells: elsewhereShellsOf({ groups, sessionId: LEDGER }) })).toBe(
      '1 shell running in other sessions',
    );
    expect(elsewhereNoteOf({ shells: elsewhereShellsOf({ groups, sessionId: null }) })).toBe(
      '2 shells running in other sessions',
    );
  });

  it('says nothing when no other session runs a shell', () => {
    const groups = [groupOf({ sessionId: LEDGER, tabs: [tabOf({ id: 'a', status: 'running' })] })];

    expect(
      elsewhereNoteOf({ shells: elsewhereShellsOf({ groups, sessionId: LEDGER }) }),
    ).toBeNull();
  });

  it('names a shell by its session, project and branch', () => {
    const groups = [groupOf({ sessionId: RELAY, tabs: [tabOf({ id: 'b', status: 'running' })] })];

    expect(elsewhereShellsOf({ groups, sessionId: null })[0]?.label).toBe(
      'Retry the webhook · ledger-core · ak/retry-budget',
    );
  });
});
