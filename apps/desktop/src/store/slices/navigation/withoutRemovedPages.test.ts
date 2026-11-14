import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type WorkflowRunId } from '@goodboy/types';
import { nextSessionId } from '@goodboy/types/testing';
import { PLACE_ROWS } from './placeRows';
import type { Location } from './types';
import { withoutRemovedPages } from './withoutRemovedPages';

const SESSION_ID = nextSessionId();
const AGENT_ID = brandId<AgentId>({ value: 'agent-saved' });
const RUN_ID = brandId<WorkflowRunId>({ value: 'run-saved' });

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
  it('lands a stored explore page on Changes, All files', () => {
    const next = withoutRemovedPages({ location: storedAt({ lens: 'explore' }) });

    expect(next.place).toMatchObject({ at: 'session', view: { lens: 'files', target: null } });
    expect(next.focus.drawer).toBeNull();
    expect(next.focus.returnRows).toEqual({ [PLACE_ROWS.changesMode]: 'all' });
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

  it('opens the agent page in place of a saved Auto child panel', () => {
    const stored: Location = JSON.parse(
      JSON.stringify({
        ...storedAt({ lens: 'questions' }),
        focus: {
          drawer: { kind: 'auto-child', sessionId: SESSION_ID, payload: { agentId: AGENT_ID } },
          scroll: {},
        },
      }),
    );

    const next = withoutRemovedPages({ location: stored });

    expect(next.place).toEqual({
      at: 'session',
      sessionId: SESSION_ID,
      view: { lens: 'workflows', agentId: AGENT_ID, target: null },
    });
    expect(next.focus.drawer).toBeNull();
  });

  it('opens the step page in place of a saved run step panel', () => {
    const stored: Location = JSON.parse(
      JSON.stringify({
        ...storedAt({ lens: 'workflows' }),
        focus: {
          drawer: {
            kind: 'run-step',
            sessionId: SESSION_ID,
            payload: { runId: RUN_ID, agentId: AGENT_ID },
          },
          scroll: {},
        },
      }),
    );

    const next = withoutRemovedPages({ location: stored });

    expect(next.place).toEqual({
      at: 'session',
      sessionId: SESSION_ID,
      view: { lens: 'workflows', agentId: AGENT_ID, target: { kind: 'run', runId: RUN_ID } },
    });
    expect(next.focus.drawer).toBeNull();
  });

  it('lands a saved panel with no agent on its session', () => {
    const stored: Location = JSON.parse(
      JSON.stringify({
        ...storedAt({ lens: 'workflows' }),
        focus: {
          drawer: { kind: 'auto-child', sessionId: SESSION_ID, payload: null },
          scroll: {},
        },
      }),
    );

    const next = withoutRemovedPages({ location: stored });

    expect(next.place).toMatchObject({ at: 'session', sessionId: SESSION_ID });
    expect(next.focus.drawer).toBeNull();
  });

  it('keeps a live drawer open on its page', () => {
    const drawer: Location['focus']['drawer'] = {
      kind: 'session-log',
      sessionId: SESSION_ID,
      payload: { focusEntryId: null },
    };
    const location: Location = {
      ...storedAt({ lens: 'questions' }),
      focus: { ...storedAt({ lens: 'questions' }).focus, drawer },
    };

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

describe('retired Context and provider addresses', () => {
  it.each([
    ['goal', 'goal'],
    ['decisions', 'decisions'],
    ['last_output_summary', 'summary'],
  ])('restores %s as the Context tab on %s', (lens, section) => {
    const next = withoutRemovedPages({ location: storedAt({ lens }) });
    expect(next.place).toMatchObject({ view: { lens: 'context', target: null } });
    expect(next.focus.drawer).toBeNull();
    expect(next.focus.returnRows).toEqual({ [PLACE_ROWS.contextSection]: section });
  });

  it('keeps a stored Context tab as it was', () => {
    const location = storedAt({ lens: 'context' });

    expect(withoutRemovedPages({ location })).toBe(location);
  });

  it.each(['linear', 'gitlab_issues', 'jira_issues', 'slack_threads'])(
    'restores the former %s list to Overview',
    (lens) => {
      expect(withoutRemovedPages({ location: storedAt({ lens }) }).place).toMatchObject({
        view: { lens: null, target: null },
      });
    },
  );

  it('restores the old Learned section as Explanations', () => {
    const location = storedLevel({
      lens: 'agents',
      agentId: null,
      target: null,
      selection: {},
      drawer: {
        kind: 'context',
        sessionId: SESSION_ID,
        payload: { tab: 'learned', view: 'current' },
      },
    });
    const next = withoutRemovedPages({ location });

    expect(next.place).toMatchObject({ view: { lens: 'context' } });
    expect(next.focus.drawer).toBeNull();
    expect(next.focus.returnRows).toMatchObject({ [PLACE_ROWS.contextSection]: 'explanations' });
  });
});
