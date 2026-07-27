import { describe, expect, it } from 'vitest';
import type { IsoDateTime, Session, SessionId, WorkspaceId } from '@goodboy/types';
import { resolveSpawnRouting } from './spawn-routing';

const NOW = '2026-07-27T00:00:00.000Z' as IsoDateTime;

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'ses-1' as SessionId,
  workspaceId: 'ws-1' as WorkspaceId,
  goal: 'g',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

describe('resolveSpawnRouting', () => {
  it('gives a generic agent the model the chat is currently on', () => {
    const routing = resolveSpawnRouting({
      kind: 'generic',
      roleModels: null,
      session: makeSession({
        providerOverride: 'anthropic',
        modelOverride: 'claude-opus-5',
        effort: 'high',
      }),
    });

    expect(routing).toEqual({
      provider: 'anthropic',
      model: 'claude-opus-5',
      effort: 'high',
      origin: 'chat',
    });
  });

  it('keeps the right-sized role default for an explicit kind, whatever the chat is on', () => {
    const routing = resolveSpawnRouting({
      kind: 'scout',
      roleModels: null,
      session: makeSession({
        providerOverride: 'anthropic',
        modelOverride: 'claude-opus-5',
        effort: 'high',
      }),
    });

    expect(routing).toEqual({
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      effort: 'low',
      origin: 'right-sized',
    });
  });

  it('falls back to the cheap default when the chat has no model pinned', () => {
    const routing = resolveSpawnRouting({
      kind: 'generic',
      roleModels: null,
      session: makeSession(),
    });

    expect(routing).toEqual({
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      effort: 'low',
      origin: 'right-sized',
    });
  });

  it('infers the provider from the chat model when the session pins none', () => {
    const routing = resolveSpawnRouting({
      kind: 'generic',
      roleModels: null,
      session: makeSession({ modelOverride: 'gpt-5.6' }),
    });

    expect(routing.provider).toBe('codex');
    expect(routing.origin).toBe('chat');
  });

  it('reports a workspace role override as a plain role default, not a right-sized one', () => {
    const routing = resolveSpawnRouting({
      kind: 'scout',
      roleModels: { scout: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'high' } },
      session: makeSession(),
    });

    expect(routing).toEqual({
      provider: 'anthropic',
      model: 'claude-opus-5',
      effort: 'high',
      origin: 'role-default',
    });
  });
});
