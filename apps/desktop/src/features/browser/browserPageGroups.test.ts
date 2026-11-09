// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { nextProjectId, nextSessionId } from '@goodboy/types/testing';
import type { BrowserTab } from '../../store/slices/browser/types';
import { browserPageGroups } from './browserPageGroups';

const PAYMENTS_API = nextProjectId();
const CHECKOUT = nextSessionId();
const ROUNDING = nextSessionId();
const WEBHOOKS = nextSessionId();

type TabParams = {
  readonly id: string;
};

const tabOf = ({ id }: TabParams): BrowserTab => ({
  id,
  sessionId: null,
  projectId: null,
  url: `https://${id}.harborline.dev`,
  title: id,
  position: 0,
  createdAt: 1,
  updatedAt: 1,
});

const SESSIONS = [
  {
    sessionId: CHECKOUT,
    title: 'Show tax in the checkout total',
    projectId: PAYMENTS_API,
    tabs: [tabOf({ id: 'checkout' })],
  },
  { sessionId: ROUNDING, title: 'Fix the rounding drift', projectId: null, tabs: [] },
  {
    sessionId: WEBHOOKS,
    title: 'Stop retried webhooks posting',
    projectId: PAYMENTS_API,
    tabs: [tabOf({ id: 'relay' })],
  },
];

const PINS = [
  { projectId: PAYMENTS_API, projectName: 'payments-api', pins: [tabOf({ id: 'guides' })] },
];

describe('the groups of the browser page', () => {
  it('lists the sessions that hold a tab in their order, then one group of pins per project', () => {
    const groups = browserPageGroups({ sessions: SESSIONS, pins: PINS, selectedId: null });

    expect(groups.map((group) => group.label)).toEqual([
      'Show tax in the checkout total',
      'Stop retried webhooks posting',
      'Pinned for payments-api',
    ]);
    expect(groups.map((group) => group.isPins)).toEqual([false, false, true]);
  });

  it('keeps the picked session even with no tab, so a page can open in it', () => {
    const groups = browserPageGroups({ sessions: SESSIONS, pins: [], selectedId: ROUNDING });

    expect(groups.map((group) => group.sessionId)).toEqual([CHECKOUT, ROUNDING, WEBHOOKS]);
  });

  it('opens a pin in the picked session when it works on that project, else in the first one that does', () => {
    const picked = browserPageGroups({ sessions: SESSIONS, pins: PINS, selectedId: WEBHOOKS });
    const elsewhere = browserPageGroups({ sessions: SESSIONS, pins: PINS, selectedId: ROUNDING });

    expect(picked.at(-1)?.sessionId).toBe(WEBHOOKS);
    expect(elsewhere.at(-1)?.sessionId).toBe(CHECKOUT);
  });

  it('drops a group of pins that no session of the page can open', () => {
    const groups = browserPageGroups({
      sessions: SESSIONS.filter((session) => session.projectId === null),
      pins: PINS,
      selectedId: null,
    });

    expect(groups).toEqual([]);
  });
});
