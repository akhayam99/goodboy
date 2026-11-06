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
      JSON.stringify({ ...storedAt({ lens: 'questions' }), studio: { kind: 'companion' } }),
    );

    const next = withoutRemovedPages({ location: stored });

    expect(next.studio).toEqual({ kind: 'settings', focus: { scope: 'app', section: 'iphone' } });
    expect(next.place).toEqual(stored.place);
  });

  it('keeps a live studio as it was', () => {
    const location: Location = { ...storedAt({ lens: 'questions' }), studio: { kind: 'guide' } };

    expect(withoutRemovedPages({ location })).toBe(location);
  });

  it('keeps a live page as it was', () => {
    const location = storedAt({ lens: 'questions' });

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

describe('withoutRemovedPages, the retired level 2 of the session rail', () => {
  it('lands a stored Auto level on the Auto agent and opens no panel', () => {
    const next = withoutRemovedPages({
      location: storedLevel({
        lens: 'auto',
        agentId: 'agent-auto-root',
        target: null,
        selection: { 'sidebar-level': 'auto', 'auto-row': 'kept' },
      }),
    });

    expect(next.place).toMatchObject({ view: { lens: 'workflows', agentId: 'agent-auto-root' } });
    expect(next.focus.drawer).toBeNull();
  });

  it('lands a stored Agents page on the Runs page, keeping its agent', () => {
    const next = withoutRemovedPages({
      location: storedLevel({
        lens: 'agents',
        agentId: 'agent-implementer',
        target: null,
        selection: {},
      }),
    });

    expect(next.place).toMatchObject({ view: { lens: 'workflows', agentId: 'agent-implementer' } });
    expect(next.focus.drawer).toBeNull();
  });

  it('lands a stored run on the run page and opens no panel', () => {
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
    expect(next.focus.drawer).toBeNull();
  });

  it('keeps the tool a stored run had open', () => {
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
});

describe('withoutRemovedPages, address parts no screen reads', () => {
  it('lands a stored agent pane on the agent page itself', () => {
    const next = withoutRemovedPages({
      location: storedLevel({
        lens: 'workflows',
        agentId: 'agent-implementer',
        target: { kind: 'agent', pane: 'transcript' },
        selection: {},
      }),
    });

    expect(next.place).toEqual({
      at: 'session',
      sessionId: SESSION_ID,
      view: { lens: 'workflows', agentId: 'agent-implementer', target: null },
    });
  });

  it('drops a stored Explore folder target', () => {
    const next = withoutRemovedPages({
      location: storedLevel({
        lens: 'branch',
        agentId: null,
        target: { kind: 'explore', mountPath: '/work/ledger-core' },
        selection: {},
      }),
    });

    expect(next.place).toMatchObject({ view: { lens: 'branch', target: null } });
  });

  it('keeps a stored thread and drops the pane it carried', () => {
    const next = withoutRemovedPages({
      location: storedLevel({
        lens: 'review',
        agentId: 'agent-fixer',
        target: { kind: 'thread', threadId: 'gh:PRRT_7', pane: 'brief' },
        selection: {},
      }),
    });

    expect(next.place).toMatchObject({
      view: { target: { kind: 'thread', threadId: 'gh:PRRT_7' } },
    });
    expect(next.place.at === 'session' ? next.place.view.target : null).toEqual({
      kind: 'thread',
      threadId: 'gh:PRRT_7',
    });
  });

  it('loads a stored focus with a selection and reveals as the page it named', () => {
    const next = withoutRemovedPages({
      location: storedLevel({
        lens: 'plans',
        agentId: null,
        target: null,
        selection: { thread: 'gh:PRRT_7' },
      }),
    });

    expect(next.place).toMatchObject({ view: { lens: 'plans', target: null } });
    expect(next.focus.drawer).toBeNull();
  });
});
