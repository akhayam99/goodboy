import { describe, expect, it } from 'vitest';
import { nextSessionId } from '@goodboy/types/testing';
import type { Location } from './types';
import { withoutRemovedPages } from './withoutRemovedPages';

const SESSION_ID = nextSessionId();

type LocationParams = {
  readonly lens: string;
};

const storedAt = ({ lens }: LocationParams): Location => {
  const stored: Location = JSON.parse(
    JSON.stringify({
      workspaceId: null,
      place: {
        at: 'session',
        sessionId: SESSION_ID,
        view: { lens, agentId: null, target: null },
      },
      studio: null,
      focus: { drawer: null, selection: {}, scroll: {}, revealed: [] },
    }),
  );
  return stored;
};

describe('withoutRemovedPages', () => {
  it('lands a stored explore page on the overview with the Explore pane open', () => {
    const next = withoutRemovedPages({ location: storedAt({ lens: 'explore' }) });

    expect(next.place).toMatchObject({ at: 'session', view: { lens: null, target: null } });
    expect(next.focus.drawer).toEqual({ kind: 'explore', sessionId: SESSION_ID, payload: null });
  });

  it('lands a stored scripts page on the overview with the Scripts pane open', () => {
    const next = withoutRemovedPages({ location: storedAt({ lens: 'scripts' }) });

    expect(next.place).toMatchObject({ at: 'session', view: { lens: null } });
    expect(next.focus.drawer).toEqual({ kind: 'scripts', sessionId: SESSION_ID, payload: null });
  });

  it('drops a stored terminal page without opening a pane', () => {
    const next = withoutRemovedPages({ location: storedAt({ lens: 'terminal' }) });

    expect(next.place).toMatchObject({ at: 'session', view: { lens: null } });
    expect(next.focus.drawer).toBeNull();
  });

  it('opens Settings, iPhone in place of a stored pairing studio', () => {
    const stored: Location = JSON.parse(
      JSON.stringify({ ...storedAt({ lens: 'agents' }), studio: { kind: 'companion' } }),
    );

    const next = withoutRemovedPages({ location: stored });

    expect(next.studio).toEqual({ kind: 'settings', focus: { scope: 'app', section: 'iphone' } });
    expect(next.place).toEqual(stored.place);
  });

  it('keeps a live studio as it was', () => {
    const location: Location = { ...storedAt({ lens: 'agents' }), studio: { kind: 'guide' } };

    expect(withoutRemovedPages({ location })).toBe(location);
  });

  it('keeps a live page as it was', () => {
    const location = storedAt({ lens: 'agents' });

    expect(withoutRemovedPages({ location })).toBe(location);
  });
});

type LevelParams = {
  readonly lens: string;
  readonly agentId: string | null;
  readonly target: unknown;
  readonly selection: Readonly<Record<string, string>>;
  readonly drawer?: unknown;
};

const storedLevel = ({
  lens,
  agentId,
  target,
  selection,
  drawer = null,
}: LevelParams): Location => {
  const stored: Location = JSON.parse(
    JSON.stringify({
      workspaceId: null,
      place: { at: 'session', sessionId: SESSION_ID, view: { lens, agentId, target } },
      studio: null,
      focus: { drawer, selection, scroll: {}, revealed: [] },
    }),
  );
  return stored;
};

const PANEL = { kind: 'spawned', sessionId: SESSION_ID, payload: null };

describe('withoutRemovedPages, the retired level 2 of the session rail', () => {
  it('lands a stored Auto level on the Auto agent with the Agents panel open and drops the level key', () => {
    const next = withoutRemovedPages({
      location: storedLevel({
        lens: 'auto',
        agentId: 'agent-auto-root',
        target: null,
        selection: { 'sidebar-level': 'auto', 'auto-row': 'kept' },
      }),
    });

    expect(next.place).toMatchObject({ view: { lens: 'auto', agentId: 'agent-auto-root' } });
    expect(next.focus.drawer).toEqual(PANEL);
    expect(next.focus.selection).toEqual({ 'auto-row': 'kept' });
  });

  it('lands a stored run on the run page with the Agents panel open', () => {
    const next = withoutRemovedPages({
      location: storedLevel({
        lens: 'workflows',
        agentId: null,
        target: { kind: 'run', runId: 'run-ledger-core' },
        selection: {},
      }),
    });

    expect(next.place).toMatchObject({
      view: { target: { kind: 'run', runId: 'run-ledger-core' } },
    });
    expect(next.focus.drawer).toEqual(PANEL);
  });

  it('keeps the drawer the run had open instead of the panel', () => {
    const drawer = { kind: 'scripts', sessionId: SESSION_ID, payload: null };
    const next = withoutRemovedPages({
      location: storedLevel({
        lens: 'workflows',
        agentId: null,
        target: { kind: 'run', runId: 'run-ledger-core' },
        selection: {},
        drawer,
      }),
    });

    expect(next.focus.drawer).toEqual(drawer);
  });

  it('opens no panel when the Auto level was left for the session level', () => {
    const next = withoutRemovedPages({
      location: storedLevel({
        lens: 'auto',
        agentId: 'agent-auto-root',
        target: null,
        selection: { 'sidebar-level': 'session' },
      }),
    });

    expect(next.focus.drawer).toBeNull();
    expect(next.focus.selection).toEqual({});
  });
});
