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

  it('keeps a live page as it was', () => {
    const location = storedAt({ lens: 'agents' });

    expect(withoutRemovedPages({ location })).toBe(location);
  });
});
