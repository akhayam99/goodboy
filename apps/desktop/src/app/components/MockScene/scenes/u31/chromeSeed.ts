import type { AgentId, Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { NOW, SESSION, seedActivityRunScene } from '../activityRunSeed';
import { seedShellChrome } from '../shellChrome';

export const CHROME_AGENT_ID = brandedId<AgentId>({ value: 'mock-run-agent-planner' });

export const CHROME_TITLE = 'Why does the ledger retry post a second credit?';

export const seedChrome = (): Session => {
  seedActivityRunScene();
  useAppStore.setState((state) => ({
    mountGithub: Object.fromEntries(
      Object.entries(state.mountGithub).map(([mountId, github]) => [
        mountId,
        { ...github, pr: null, prs: [], detail: null },
      ]),
    ),
  }));
  seedShellChrome({
    session: SESSION,
    siblings: [],
    branches: {},
    telemetryAt: NOW,
    lens: null,
  });
  return SESSION;
};
