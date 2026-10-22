import { beforeEach, describe, expect, it } from 'vitest';
import { getSetting, insertSettingIfAbsent } from '@goodboy/db';
import {
  brandId,
  parseWorkflowRules,
  type AgentId,
  type RunRoute,
  type SessionId,
} from '@goodboy/types';
import { openStorySqlite, storySqlite } from '../../../store/storyHarness';
import { runRoutesKey, writeRunRoute } from './runRoutesSetting';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const FIRST = brandId<AgentId>({ value: 'agent-ledger-core' });
const SECOND = brandId<AgentId>({ value: 'agent-notify-relay' });

const LEAD: RunRoute = {
  shape: 'lead',
  row: 6,
  presetName: null,
  closeness: null,
  role: null,
  choice: 'One agent that starts what it needs',
  why: 'Not sure yet: one agent first',
};

const QUESTION: RunRoute = { ...LEAD, row: 5, why: 'A question or a check, and no preset fits' };

const readRoutes = async (): Promise<unknown> =>
  JSON.parse((await getSetting(storySqlite(), runRoutesKey({ sessionId: SESSION }))) ?? '{}');

beforeEach(async () => {
  await openStorySqlite();
});

describe('the route of each run, kept in the settings table', () => {
  it('keeps both routes when two windows start a run at once', async () => {
    await Promise.all([
      writeRunRoute({ db: storySqlite(), sessionId: SESSION, agentId: FIRST, route: LEAD }),
      writeRunRoute({ db: storySqlite(), sessionId: SESSION, agentId: SECOND, route: QUESTION }),
    ]);

    expect(await readRoutes()).toEqual({ [FIRST]: LEAD, [SECOND]: QUESTION });
  });

  it('drops an entry it cannot read when it writes the next route', async () => {
    await insertSettingIfAbsent({
      db: storySqlite(),
      key: runRoutesKey({ sessionId: SESSION }),
      value: '{"agent-ledger-core":{"shape":"wizard"}}',
    });

    await writeRunRoute({ db: storySqlite(), sessionId: SESSION, agentId: SECOND, route: LEAD });

    expect(await readRoutes()).toEqual({ [SECOND]: LEAD });
  });

  it('reads the route of a plan back from its run rules', () => {
    const rules = parseWorkflowRules({
      value: JSON.parse(JSON.stringify({ autonomy: 'run', guidanceRoles: [], route: QUESTION })),
    });

    expect(rules?.route).toEqual(QUESTION);
  });
});
