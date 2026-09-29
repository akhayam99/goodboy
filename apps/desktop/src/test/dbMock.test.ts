// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createDbMock } from './dbMock';
import { createInvokeMock } from './invokeMock';
import { drainUnexpectedCalls } from './unexpectedCalls';

describe('createDbMock', () => {
  it('records a call nobody stubbed, with its name and arguments, and returns an inert value', async () => {
    const db = await createDbMock({});

    const events = await db.countUserTextEvents({ agentId: 'agent-1' } as never);
    const rows = await db.listSessionDecisions({ sessionId: 'session-1' } as never);

    expect([events, rows]).toEqual([0, []]);
    expect(drainUnexpectedCalls()).toEqual([
      'db: countUserTextEvents({"agentId":"agent-1"})',
      'db: listSessionDecisions({"sessionId":"session-1"})',
    ]);
  });

  it('passes a stub through without recording it', async () => {
    const db = await createDbMock({ countUserTextEvents: async () => 7 });

    expect(await db.countUserTextEvents({ agentId: 'agent-1' } as never)).toBe(7);
    expect(drainUnexpectedCalls()).toEqual([]);
  });

  it('keeps the constants of the real module', async () => {
    const db = await createDbMock({});

    expect(db.NOTIFICATION_LIST_LIMIT).toBe(200);
  });

  it('refuses a stub the real module does not export', async () => {
    await expect(createDbMock({ listWorktreesForTask: async () => [] })).rejects.toThrow(
      'listWorktreesForTask',
    );
  });
});

describe('createInvokeMock', () => {
  it('records a command nobody handled and resolves to the unknown result', async () => {
    const invoke = createInvokeMock({ unknownResult: null });

    expect(await invoke('gh_status', { workspaceId: 'workspace-1' })).toBeNull();
    expect(drainUnexpectedCalls()).toEqual(['invoke: gh_status({"workspaceId":"workspace-1"})']);
  });

  it('answers a handled command with its value or its function result', async () => {
    const invoke = createInvokeMock({
      handlers: {
        terminal_list_live: [],
        gh_run: ({ args }: { readonly args: ReadonlyArray<string> }) => ({ echoed: args }),
      },
    });

    expect(await invoke('terminal_list_live')).toEqual([]);
    expect(await invoke('gh_run', { args: ['repo', 'view'] })).toEqual({
      echoed: ['repo', 'view'],
    });
    expect(drainUnexpectedCalls()).toEqual([]);
  });
});
