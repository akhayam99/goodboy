// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import type { AgentId, SessionId, WorkspaceId } from '@goodboy/types';
import { consumeReloadIntent, restoredLayers, writeReloadIntent } from './windowView';

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

  it('carries the whole location of the window through a reload', () => {
    const location = {
      workspaceId: ws,
      place: {
        at: 'session' as const,
        sessionId: session,
        view: {
          lens: 'workflows' as const,
          agentId: null,
          studio: null,
          target: { kind: 'run' as const, runId: 'wfrun-1' },
        },
      },
      studio: null,
      focus: {
        drawer: {
          kind: 'context' as const,
          sessionId: session,
          payload: { tab: 'summary' as const, view: 'current' as const },
        },
        selection: {},
        scroll: { timeline: 240 },
        revealed: ['step-2'],
      },
    };
    writeReloadIntent({
      mode: 'restore',
      workspaceId: ws,
      sessionId: session,
      agentId: null,
      location,
    });
    expect(consumeReloadIntent()).toEqual({
      mode: 'restore',
      workspaceId: ws,
      sessionId: session,
      agentId: null,
      location,
    });
  });

  it('drops a location it cannot read and keeps the rest of the intent', () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        mode: 'restore',
        workspaceId: ws,
        sessionId: null,
        agentId: null,
        location: { place: { at: 'nowhere' } },
      }),
    );
    expect(consumeReloadIntent()).toEqual({
      mode: 'restore',
      workspaceId: ws,
      sessionId: null,
      agentId: null,
    });
  });

  it('carries the layer path of the session and drops one that names another session', () => {
    const layers = [
      {
        at: 'session',
        sessionId: session,
        view: { lens: 'pr', agentId: null, studio: null, target: null },
      },
      {
        at: 'session',
        sessionId: session,
        view: { lens: 'review', agentId: null, studio: null, target: null },
      },
    ] as const;
    writeReloadIntent({
      mode: 'restore',
      workspaceId: ws,
      sessionId: session,
      agentId: null,
      layers,
    });
    const intent = consumeReloadIntent();

    expect(intent === null ? [] : restoredLayers({ intent, sessionId: session })).toEqual(layers);
    expect(
      intent === null ? [] : restoredLayers({ intent, sessionId: 'sess-2' as SessionId }),
    ).toEqual([]);
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
