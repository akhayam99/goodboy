// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { extractQualifiers } from './grammar';
import { toSearchQuery } from './toSearchQuery';
import { widenScope, type SearchScope } from './searchScope';

const NOW = new Date(2026, 8, 27, 15).getTime();
const PROJECTS = [
  { id: 'p-ledger' as ProjectId, name: 'ledger-core' },
  { id: 'p-relay' as ProjectId, name: 'notify-relay' },
];

type RunParams = {
  readonly text: string;
  readonly isFinal?: boolean;
};

const run = ({ text, isFinal = false }: RunParams) =>
  extractQualifiers({ text, projects: PROJECTS, now: NOW, isFinal });

describe('search grammar', () => {
  it('turns a finished type qualifier into the Type chip and keeps the words', () => {
    expect(run({ text: 'settlement type:message ' })).toEqual({
      text: 'settlement ',
      chips: [{ key: 'type', kinds: ['message'], label: 'Messages' }],
    });
  });

  it('waits while the qualifier is still being typed', () => {
    expect(run({ text: 'settlement type:mess' })).toEqual({
      text: 'settlement type:mess',
      chips: [],
    });
    expect(run({ text: 'settlement type:message', isFinal: true }).chips).toHaveLength(1);
  });

  it('maps every qualifier to its chip', () => {
    const { text, chips } = run({
      text: 'type:artifact in:ledger-core from:claude is:open is:archived after:2026-09-01 before:7d drift ',
    });
    expect(text).toBe('drift ');
    expect(chips).toEqual([
      { key: 'type', kinds: ['plan', 'report', 'wireframe'], label: 'Artifacts' },
      { key: 'project', projectId: 'p-ledger', label: 'ledger-core' },
      { key: 'provider', provider: 'anthropic', label: 'Claude' },
      { key: 'status', status: 'open', label: 'Open' },
      { key: 'archived', label: 'Archived' },
      { key: 'after', at: new Date(2026, 8, 1).getTime(), label: expect.any(String) },
      { key: 'before', at: new Date(2026, 8, 20).getTime(), label: expect.any(String) },
    ]);
  });

  it('leaves unknown values as words', () => {
    expect(run({ text: 'in:nowhere from:mars is:sleepy type:emoji after:soon ' }).chips).toEqual(
      [],
    );
  });

  it('builds the query from scope and chips', () => {
    const scope: SearchScope = {
      kind: 'session',
      sessionId: 's1' as SessionId,
      workspaceId: 'w1' as WorkspaceId,
      label: 'Payout export',
    };
    const { chips } = run({ text: 'type:plan type:report is:archived from:codex ' });
    expect(toSearchQuery({ text: 'drift', scope, chips })).toMatchObject({
      text: 'drift',
      kinds: ['plan', 'report'],
      sessionId: 's1',
      workspaceId: 'w1',
      providers: ['codex'],
      archived: 'only',
    });
    expect(toSearchQuery({ text: '', scope: { kind: 'all' }, chips: [] })).toMatchObject({
      sessionId: null,
      workspaceId: null,
      archived: 'exclude',
    });
  });

  it('widens a session scope to its workspace, then to everything', () => {
    const session: SearchScope = {
      kind: 'session',
      sessionId: 's1' as SessionId,
      workspaceId: 'w1' as WorkspaceId,
      label: 'Payout export',
    };
    const workspace = widenScope({ scope: session, workspaceLabel: 'Harborline' });
    expect(workspace).toEqual({ kind: 'workspace', workspaceId: 'w1', label: 'Harborline' });
    expect(widenScope({ scope: workspace, workspaceLabel: 'Harborline' })).toEqual({ kind: 'all' });
  });
});
