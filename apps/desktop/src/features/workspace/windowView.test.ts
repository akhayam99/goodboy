// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import type { AgentId, SessionId, WorkspaceId } from '@goodboy/types';
import { consumeReloadIntent, writeReloadIntent } from './windowView';

const KEY = 'goodboy:window-reload-intent';

const ws = 'ws-1' as WorkspaceId;
const session = 'sess-1' as SessionId;
const agent = 'agent-1' as AgentId;

describe('windowView reload intent', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('round-trips a restore intent', () => {
    writeReloadIntent({ mode: 'restore', workspaceId: ws, sessionId: session, agentId: agent });
    expect(consumeReloadIntent()).toEqual({
      mode: 'restore',
      workspaceId: ws,
      sessionId: session,
      agentId: agent,
    });
  });

  it('round-trips a fresh intent', () => {
    writeReloadIntent({ mode: 'fresh' });
    expect(consumeReloadIntent()).toEqual({ mode: 'fresh' });
  });

  it('is one-shot: a second consume returns null', () => {
    writeReloadIntent({ mode: 'restore', workspaceId: ws, sessionId: null, agentId: null });
    expect(consumeReloadIntent()).not.toBeNull();
    expect(consumeReloadIntent()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('returns null when no intent is stored', () => {
    expect(consumeReloadIntent()).toBeNull();
  });

  it('returns null and clears on malformed json', () => {
    sessionStorage.setItem(KEY, '{not json');
    expect(consumeReloadIntent()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('rejects a restore intent missing a workspaceId', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ mode: 'restore', sessionId: session }));
    expect(consumeReloadIntent()).toBeNull();
  });
});
