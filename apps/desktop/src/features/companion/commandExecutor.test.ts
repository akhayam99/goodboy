import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BridgeCommand } from './commandExecutor';

// Hermetic mocks: the executor pulls the whole app store, core, the window
// helper and the tauri event/core bridges at module load. The guard logic we
// test here touches none of that machinery directly, so stub it all out.
const h = vi.hoisted(() => ({
  sendTurn: vi.fn((..._args: unknown[]) => Promise.resolve()),
  spawnAgent: vi.fn((..._args: unknown[]) => Promise.resolve()),
  activateWorkflowAgent: vi.fn((..._args: unknown[]) => Promise.resolve()),
  state: { value: null as unknown },
}));

vi.mock('../../store/store', () => ({ useAppStore: { getState: () => h.state.value } }));
vi.mock('@goodboy/core', () => ({
  ROLE_REGISTRY: {
    scout: { presentationKey: 'scout' },
    investigator: { presentationKey: 'debugger' },
    planner: { presentationKey: 'planner' },
    implementer: { presentationKey: 'implementer' },
    reviewer: { presentationKey: 'reviewer' },
    tester: { presentationKey: 'tester' },
    resolver: { presentationKey: 'resolver' },
    docs: { presentationKey: 'docs' },
    custom: { presentationKey: 'generic' },
  },
  SELECTABLE_AGENT_ROLES: [
    'scout',
    'investigator',
    'planner',
    'implementer',
    'reviewer',
    'tester',
    'resolver',
    'docs',
    'custom',
  ],
  runsForWorkflowRun: () => [],
}));
vi.mock('../workspace/window', () => ({ isMainWindow: () => true }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

import { executeBridgeCommand } from './commandExecutor';

function makeStore(over: Record<string, unknown> = {}) {
  return {
    sessions: [{ id: 's1', workspaceId: 'w1', workflowRuns: [] }],
    phaseTemplates: {},
    sessionPhaseRuns: {},
    sendTurn: h.sendTurn,
    spawnAgent: h.spawnAgent,
    activateWorkflowAgent: h.activateWorkflowAgent,
    ...over,
  };
}

function cmd(kind: string, data: unknown, origin: 'desktop' | 'mobile' = 'mobile'): BridgeCommand {
  return { id: 'c1', kind, origin, data };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.state.value = makeStore();
});

describe('origin enforcement', () => {
  it('refuses a non-mobile origin instead of guessing', async () => {
    const res = await executeBridgeCommand(
      cmd('send', { sessionId: 's1', content: 'hi' }, 'desktop'),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/origin/i);
    expect(h.sendTurn).not.toHaveBeenCalled();
  });

  it('refuses an unknown command kind', async () => {
    const res = await executeBridgeCommand(cmd('rmrf', { sessionId: 's1' }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/unsupported/i);
  });
});

describe('session scoping', () => {
  it('rejects a command for a session the desktop does not know', async () => {
    const res = await executeBridgeCommand(cmd('send', { sessionId: 'ghost', content: 'hi' }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/unknown session/i);
    expect(h.sendTurn).not.toHaveBeenCalled();
  });

  it('rejects a command with no sessionId', async () => {
    const res = await executeBridgeCommand(cmd('send', { content: 'hi' }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/missing sessionId/i);
  });
});

describe('send', () => {
  it('rejects an empty turn (no content, no attachments)', async () => {
    const res = await executeBridgeCommand(cmd('send', { sessionId: 's1', content: '   ' }));
    expect(res.ok).toBe(false);
    expect(h.sendTurn).not.toHaveBeenCalled();
  });

  it('dispatches a valid turn', async () => {
    const res = await executeBridgeCommand(cmd('send', { sessionId: 's1', content: 'ship it' }));
    expect(res.ok).toBe(true);
    expect(h.sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 's1', content: 'ship it' }),
    );
  });

  it('forwards an agentId when answering a specific agent', async () => {
    await executeBridgeCommand(cmd('send', { sessionId: 's1', agentId: 'a9', content: 'yes' }));
    expect(h.sendTurn).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'a9' }));
  });

  it('keeps only well-formed attachments and drops malformed ones', async () => {
    await executeBridgeCommand(
      cmd('send', {
        sessionId: 's1',
        content: '',
        attachments: [
          { id: 'a', fileName: 'a.jpg', mimeType: 'image/jpeg', dataBase64: 'AAA' },
          { id: 'b', fileName: 'b.jpg' }, // missing mimeType/data → dropped
          'not-an-object',
        ],
      }),
    );
    const arg = h.sendTurn.mock.calls[0]![0] as { attachments?: unknown[] };
    expect(arg.attachments).toHaveLength(1);
  });
});

describe('spawnAgent kind allow-list', () => {
  it('passes a whitelisted kind through as an override', async () => {
    const res = await executeBridgeCommand(
      cmd('spawnAgent', { sessionId: 's1', kind: 'reviewer' }),
    );
    expect(res.ok).toBe(true);
    expect(h.spawnAgent).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ kindOverride: 'reviewer' }),
    );
  });

  it('drops a kind that is not on the allow-list (no override → safe default)', async () => {
    const res = await executeBridgeCommand(cmd('spawnAgent', { sessionId: 's1', kind: 'root' }));
    expect(res.ok).toBe(true);
    const opts = h.spawnAgent.mock.calls[0]![1] as Record<string, unknown>;
    expect(opts.kindOverride).toBeUndefined();
  });

  it('drops registered kinds that are unavailable for selection', async () => {
    await executeBridgeCommand(cmd('spawnAgent', { sessionId: 's1', kind: 'report' }));
    await executeBridgeCommand(cmd('spawnAgent', { sessionId: 's1', kind: 'wireframe' }));

    expect(h.spawnAgent.mock.calls[0]?.[1]).not.toHaveProperty('kindOverride');
    expect(h.spawnAgent.mock.calls[1]?.[1]).not.toHaveProperty('kindOverride');
  });
});

describe('resolveComment', () => {
  it('requires a prompt describing the comment', async () => {
    const res = await executeBridgeCommand(cmd('resolveComment', { sessionId: 's1' }));
    expect(res.ok).toBe(false);
    expect(h.spawnAgent).not.toHaveBeenCalled();
  });

  it('spawns a resolver and activates it', async () => {
    const res = await executeBridgeCommand(
      cmd('resolveComment', {
        sessionId: 's1',
        prompt: 'address alice',
        commentUrl: 'https://x/1',
      }),
    );
    expect(res.ok).toBe(true);
    expect(h.spawnAgent).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({
        kindOverride: 'resolver',
        sourceCommentUrl: 'https://x/1',
      }),
    );
  });
});
