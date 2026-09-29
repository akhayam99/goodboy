import { describe, expect, it } from 'vitest';
import { createDbMock } from '../../../test/dbMock';
import { createInvokeMock } from '../../../test/invokeMock';
import { drainUnexpectedCalls } from '../../../test/unexpectedCalls';

describe('unstubbed calls fixture', () => {
  it('calls a db function nobody stubbed', async () => {
    const db = await createDbMock({});
    await db.countUserTextEvents({ agentId: 'agent-1' } as never);
    expect(1).toBe(1);
  });

  it('calls an invoke command nobody stubbed', async () => {
    const invoke = createInvokeMock({});
    await invoke('workspace_script_list_live');
    expect(1).toBe(1);
  });

  it('stubs what it calls', async () => {
    const db = await createDbMock({ countUserTextEvents: async () => 3 });
    const invoke = createInvokeMock({ handlers: { workspace_script_list_live: [] } });
    expect(await db.countUserTextEvents({ agentId: 'agent-1' } as never)).toBe(3);
    expect(await invoke('workspace_script_list_live')).toEqual([]);
  });

  it('drains the record itself when the call is the point of the test', async () => {
    const invoke = createInvokeMock({});
    await invoke('workspace_script_list_live');
    expect(drainUnexpectedCalls()).toEqual(['invoke: workspace_script_list_live(undefined)']);
  });
});
