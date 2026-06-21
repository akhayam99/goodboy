import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BridgeCommand } from './commandExecutor';

// Hermetic mocks, mirroring commandExecutor.test.ts. This file exercises the
// command kinds the sibling suite leaves untested: queryProviders, advanceStep,
// setContextSlot, the provider-override coercion, and the full spawnAgent option
// mapping. The `@goodboy/core` stubs reproduce the *real* behaviour the guard
// relies on — the genuine SLOT_KEYS set (so the editable allow-list is tested
// against the same keys production uses) and a faithful runsForWorkflowRun.
const h = vi.hoisted(() => ({
  sendTurn: vi.fn(() => Promise.resolve()),
  spawnAgent: vi.fn(() => Promise.resolve()),
  activateWorkflowAgent: vi.fn(() => Promise.resolve()),
  activateNextResolver: vi.fn(() => Promise.resolve()),
  upsertSessionSlot: vi.fn(() => Promise.resolve()),
  state: { value: null as unknown },
}));

const core = vi.hoisted(() => {
  // Mirrors packages/core/src/context/slots.ts exactly.
  const SLOT_KEY_SET = new Set([
    'goal',
    'files_touched',
    'decisions',
    'open_questions',
    'last_output_summary',
  ]);
  const PROVIDER_CAPABILITIES = {
    anthropic: {
      models: [
        { id: 'claude-opus-4-8', label: 'Opus 4.8', tier: 'turn' },
        { id: 'claude-haiku', label: 'Haiku', tier: 'utility' },
      ],
    },
    cursor: { models: [{ id: 'cursor-fast', label: 'Cursor Fast', tier: 'turn' }] },
    codex: { models: [{ id: 'gpt-5-codex', label: 'Codex', tier: 'turn' }] },
    gemini: { models: [{ id: 'gemini-2-pro', label: 'Gemini Pro', tier: 'turn' }] },
  } as Record<string, { models: Array<{ id: string; label: string; tier: string }> }>;
  return {
    isSlotKey: (k: string) => SLOT_KEY_SET.has(k),
    PROVIDER_CAPABILITIES,
    getDefaultTurnModel: (id: string) => {
      const caps = PROVIDER_CAPABILITIES[id];
      return caps.models.find((m) => m.tier === 'turn')?.id ?? caps.models[0]!.id;
    },
    // Real implementation from packages/core/src/workflows/sequencer.ts.
    runsForWorkflowRun: (runs: ReadonlyArray<{ workflowRunId?: string }>, id: string) =>
      runs.filter((r) => r.workflowRunId === id),
  };
});

vi.mock('../../store/store', () => ({ useAppStore: { getState: () => h.state.value } }));
vi.mock('@goodboy/core', () => core);
vi.mock('../providers/providers', () => ({
  PROVIDER_LABEL_LOWER: { anthropic: 'claude', cursor: 'cursor', codex: 'codex', gemini: 'gemini' },
}));
vi.mock('../workspace/window', () => ({ isMainWindow: () => true }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

import { executeBridgeCommand } from './commandExecutor';
import { clearMobileSharedSessions, isSessionMobileShared } from './mobileConfinement';
import type { SessionId } from '@goodboy/types';

function makeStore(over: Record<string, unknown> = {}) {
  return {
    sessions: [{ id: 's1', workspaceId: 'w1', workflowRuns: [] }],
    providers: [],
    phaseTemplates: {},
    sessionPhaseRuns: {},
    sendTurn: h.sendTurn,
    spawnAgent: h.spawnAgent,
    activateWorkflowAgent: h.activateWorkflowAgent,
    activateNextResolver: h.activateNextResolver,
    upsertSessionSlot: h.upsertSessionSlot,
    ...over,
  };
}

function cmd(kind: string, data: unknown, origin: 'desktop' | 'mobile' = 'mobile'): BridgeCommand {
  return { id: 'c1', kind, origin, data };
}

const lastCall = (spy: ReturnType<typeof vi.fn>) => spy.mock.calls[spy.mock.calls.length - 1];

beforeEach(() => {
  vi.clearAllMocks();
  clearMobileSharedSessions();
  h.state.value = makeStore();
});

describe('queryProviders (read-only menu RPC)', () => {
  it('returns the full closed provider set without needing a session', async () => {
    const res = await executeBridgeCommand(cmd('queryProviders', {}));
    expect(res.ok).toBe(true);
    const providers = (res.data as { providers: Array<{ id: string }> }).providers;
    expect(providers.map((p) => p.id)).toEqual(['anthropic', 'cursor', 'codex', 'gemini']);
  });

  it('reflects live connection state from the store and lists models per provider', async () => {
    h.state.value = makeStore({
      providers: [{ id: 'anthropic', label: 'claude', connection: 'connected' }],
    });
    const res = await executeBridgeCommand(cmd('queryProviders', {}));
    const providers = (
      res.data as {
        providers: Array<{
          id: string;
          connection: string;
          defaultModel: string;
          models: unknown[];
        }>;
      }
    ).providers;
    const anthropic = providers.find((p) => p.id === 'anthropic')!;
    const codex = providers.find((p) => p.id === 'codex')!;
    expect(anthropic.connection).toBe('connected');
    expect(anthropic.defaultModel).toBe('claude-opus-4-8');
    expect(codex.connection).toBe('missing'); // not in store → falls back
    expect(anthropic.models.length).toBeGreaterThan(0);
  });

  it('does not mark any session shared (read-only)', async () => {
    await executeBridgeCommand(cmd('queryProviders', {}));
    expect(isSessionMobileShared('s1' as SessionId)).toBe(false);
  });
});

describe('setContextSlot editable allow-list', () => {
  it('writes an editable slot and confines the session', async () => {
    const res = await executeBridgeCommand(
      cmd('setContextSlot', { sessionId: 's1', key: 'goal', value: 'ship the bridge' }),
    );
    expect(res.ok).toBe(true);
    expect(h.upsertSessionSlot).toHaveBeenCalledWith('s1', 'goal', 'ship the bridge');
    expect(isSessionMobileShared('s1' as SessionId)).toBe(true);
  });

  it.each(['goal', 'decisions', 'open_questions', 'last_output_summary'])(
    'accepts editable slot %s',
    async (key) => {
      const res = await executeBridgeCommand(
        cmd('setContextSlot', { sessionId: 's1', key, value: 'x' }),
      );
      expect(res.ok).toBe(true);
      expect(h.upsertSessionSlot).toHaveBeenCalledWith('s1', key, 'x');
    },
  );

  it('rejects files_touched even though it is a valid slot key (machine-derived)', async () => {
    const res = await executeBridgeCommand(
      cmd('setContextSlot', { sessionId: 's1', key: 'files_touched', value: '/etc/passwd' }),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not editable from mobile/i);
    expect(h.upsertSessionSlot).not.toHaveBeenCalled();
  });

  it('rejects a key that is not a slot key at all', async () => {
    const res = await executeBridgeCommand(
      cmd('setContextSlot', { sessionId: 's1', key: 'secrets', value: 'x' }),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not editable from mobile/i);
    expect(h.upsertSessionSlot).not.toHaveBeenCalled();
  });

  it('rejects a missing key', async () => {
    const res = await executeBridgeCommand(cmd('setContextSlot', { sessionId: 's1', value: 'x' }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not editable from mobile/i);
  });

  it('rejects an absent value (only string values are allowed)', async () => {
    const res = await executeBridgeCommand(cmd('setContextSlot', { sessionId: 's1', key: 'goal' }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/requires a string value/i);
    expect(h.upsertSessionSlot).not.toHaveBeenCalled();
  });

  it('rejects a non-string value', async () => {
    const res = await executeBridgeCommand(
      cmd('setContextSlot', { sessionId: 's1', key: 'goal', value: 42 }),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/requires a string value/i);
  });

  it('allows an explicit empty string to clear a slot', async () => {
    const res = await executeBridgeCommand(
      cmd('setContextSlot', { sessionId: 's1', key: 'decisions', value: '' }),
    );
    expect(res.ok).toBe(true);
    expect(h.upsertSessionSlot).toHaveBeenCalledWith('s1', 'decisions', '');
  });

  it('still enforces session scoping', async () => {
    const res = await executeBridgeCommand(
      cmd('setContextSlot', { sessionId: 'ghost', key: 'goal', value: 'x' }),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/unknown session/i);
  });
});

describe('provider/model override coercion', () => {
  it('forwards a whitelisted provider + model on send', async () => {
    await executeBridgeCommand(
      cmd('send', { sessionId: 's1', content: 'go', providerId: 'codex', model: 'gpt-5-codex' }),
    );
    expect(h.sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({ override: { providerId: 'codex', model: 'gpt-5-codex' } }),
    );
  });

  it('drops an override whose provider is outside the closed set', async () => {
    await executeBridgeCommand(
      cmd('send', { sessionId: 's1', content: 'go', providerId: 'openai', model: 'gpt-4' }),
    );
    const arg = lastCall(h.sendTurn)[0] as Record<string, unknown>;
    expect(arg.override).toBeUndefined();
  });

  it('forwards a provider with no model (provider-only override)', async () => {
    await executeBridgeCommand(
      cmd('send', { sessionId: 's1', content: 'go', providerId: 'gemini' }),
    );
    expect(h.sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({ override: { providerId: 'gemini' } }),
    );
  });
});

describe('spawnAgent option mapping', () => {
  it('maps name, prompt, whitelisted kind and override into store options', async () => {
    const res = await executeBridgeCommand(
      cmd('spawnAgent', {
        sessionId: 's1',
        name: 'Scout A',
        prompt: 'investigate the flake',
        kind: 'scout',
        providerId: 'codex',
        model: 'gpt-5-codex',
      }),
    );
    expect(res.ok).toBe(true);
    expect(h.spawnAgent).toHaveBeenCalledWith('s1', {
      name: 'Scout A',
      initialPrompt: 'investigate the flake',
      kindOverride: 'scout',
      provider: 'codex',
      model: 'gpt-5-codex',
    });
    expect(isSessionMobileShared('s1' as SessionId)).toBe(true);
  });

  it('spawns with no options (plan-approval affordance: desktop auto-selects)', async () => {
    const res = await executeBridgeCommand(cmd('spawnAgent', { sessionId: 's1' }));
    expect(res.ok).toBe(true);
    expect(h.spawnAgent).toHaveBeenCalledWith('s1', {});
  });
});

describe('advanceStep workflow advancement', () => {
  function workflowStore(
    over: { runs?: unknown[]; phaseRuns?: unknown[]; discardedAt?: string | null } = {},
  ) {
    const discardedAt = over.discardedAt ?? null;
    return makeStore({
      sessions: [
        {
          id: 's1',
          workspaceId: 'w1',
          workflowRuns: over.runs ?? [{ id: 'run1', workflowId: 'wf1', discardedAt }],
        },
      ],
      phaseTemplates: {
        w1: [
          {
            id: 'wf1',
            steps: [
              { id: 'step1', ordinal: 0 },
              { id: 'step2', ordinal: 1 },
            ],
          },
        ],
      },
      sessionPhaseRuns: { s1: over.phaseRuns ?? [] },
    });
  }

  it('activates the next pending step whose predecessors are complete', async () => {
    h.state.value = workflowStore({
      phaseRuns: [
        { id: 'ag1', workflowRunId: 'run1', stepId: 'step1', status: 'completed' },
        { id: 'ag2', workflowRunId: 'run1', stepId: 'step2', status: 'pending' },
      ],
    });
    const res = await executeBridgeCommand(cmd('advanceStep', { sessionId: 's1' }));
    expect(res.ok).toBe(true);
    expect(h.activateWorkflowAgent).toHaveBeenCalledWith('s1', 'ag2');
    expect(isSessionMobileShared('s1' as SessionId)).toBe(true);
  });

  it('activates the first step when nothing has run yet (no predecessors)', async () => {
    h.state.value = workflowStore({
      phaseRuns: [{ id: 'ag1', workflowRunId: 'run1', stepId: 'step1', status: 'pending' }],
    });
    const res = await executeBridgeCommand(cmd('advanceStep', { sessionId: 's1' }));
    expect(res.ok).toBe(true);
    expect(h.activateWorkflowAgent).toHaveBeenCalledWith('s1', 'ag1');
  });

  it('refuses to skip ahead when an earlier step is still running', async () => {
    h.state.value = workflowStore({
      phaseRuns: [
        { id: 'ag1', workflowRunId: 'run1', stepId: 'step1', status: 'running' },
        { id: 'ag2', workflowRunId: 'run1', stepId: 'step2', status: 'pending' },
      ],
    });
    const res = await executeBridgeCommand(cmd('advanceStep', { sessionId: 's1' }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no workflow step is ready/i);
    expect(h.activateWorkflowAgent).not.toHaveBeenCalled();
  });

  it('errors when the session has no workflow at all', async () => {
    const res = await executeBridgeCommand(cmd('advanceStep', { sessionId: 's1' }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no workflow to advance/i);
  });

  it('treats a discarded run as having no advanceable step', async () => {
    h.state.value = workflowStore({
      discardedAt: '2026-01-01T00:00:00Z',
      phaseRuns: [{ id: 'ag1', workflowRunId: 'run1', stepId: 'step1', status: 'pending' }],
    });
    const res = await executeBridgeCommand(cmd('advanceStep', { sessionId: 's1' }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no workflow step is ready/i);
    expect(h.activateWorkflowAgent).not.toHaveBeenCalled();
  });
});

describe('send attachments-only happy path', () => {
  it('accepts a turn with no text but a well-formed attachment', async () => {
    const res = await executeBridgeCommand(
      cmd('send', {
        sessionId: 's1',
        content: '',
        attachments: [{ id: 'a', fileName: 'a.jpg', mimeType: 'image/jpeg', dataBase64: 'AAA' }],
      }),
    );
    expect(res.ok).toBe(true);
    const arg = lastCall(h.sendTurn)[0] as { attachments?: unknown[] };
    expect(arg.attachments).toHaveLength(1);
  });
});

describe('resolveComment thread metadata', () => {
  it('forwards threadId as sourceThreadId', async () => {
    await executeBridgeCommand(
      cmd('resolveComment', { sessionId: 's1', prompt: 'address bob', threadId: 'T42' }),
    );
    expect(h.spawnAgent).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ kindOverride: 'resolver', sourceThreadId: 'T42' }),
    );
  });
});
