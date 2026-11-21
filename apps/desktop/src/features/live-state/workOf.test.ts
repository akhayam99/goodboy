import { describe, expect, it } from 'vitest';
import type { LiveWorkRow } from './readLiveWork';
import { workOf } from './workOf';

const row = (patch: Partial<LiveWorkRow>): LiveWorkRow => ({
  runId: 'run-1',
  sessionId: 'session-1',
  agentId: 'agent-1',
  mountId: 'mount-1',
  workflowRunId: null,
  branch: 'ak/ledger-export',
  startedAt: 1000,
  quietMs: 4000,
  tool: { name: 'Bash', command: 'pnpm test retry --watch', path: null },
  hasToolCall: true,
  ...patch,
});

const names = new Map([['mount-1', 'payments-api']]);
const titles = new Map([['session-1', 'Export the ledger']]);

describe('workOf', () => {
  it('names the project of the mount and keeps the script words in the phrase', () => {
    const [work] = workOf({ rows: [row({})], mountNames: names, sessionTitles: titles });
    expect(work?.place).toEqual({ kind: 'project', name: 'payments-api' });
    expect(work?.phrase).toBe('Running pnpm test retry in payments-api');
    expect(work?.quietMs).toBe(4000);
  });

  it('falls back to the session title when the mount is unknown', () => {
    const [work] = workOf({
      rows: [row({ mountId: 'mount-9' })],
      mountNames: names,
      sessionTitles: titles,
    });
    expect(work?.place).toEqual({ kind: 'session', title: 'Export the ledger' });
  });

  it('says no tool call yet for a run that ran no tool', () => {
    const [work] = workOf({
      rows: [row({ tool: null, hasToolCall: false })],
      mountNames: names,
      sessionTitles: titles,
    });
    expect(work?.phrase).toBe('No tool call yet');
  });

  it('says the answer is being written when a tool ran earlier but none is open', () => {
    const [work] = workOf({
      rows: [row({ tool: null, hasToolCall: true })],
      mountNames: names,
      sessionTitles: titles,
    });
    expect(work?.phrase).toBe('Writing the answer');
  });

  it('returns no work for no rows', () => {
    expect(workOf({ rows: [], mountNames: names, sessionTitles: titles })).toEqual([]);
  });
});
