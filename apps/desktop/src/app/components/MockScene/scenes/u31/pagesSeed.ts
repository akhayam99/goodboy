import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { ACTIVITY_QUESTION_SESSION, seedActivityQuestionScene } from '../activityQuestionSeed';
import { FLOW_SESSION, FLOW_SESSION_ID, NOW, SESSIONS } from '../flow-audit/fixtures';
import { seedWorkflowRun } from '../flow-audit/seeds';
import { seedShellChrome } from '../shellChrome';
import { seedC08 } from '../u25/c08RunSeed';

export type PagesPage = 'overview' | 'runs' | 'run';

type PageParams = {
  readonly page: PagesPage;
};

const OVERVIEW_BRANCH = 'nw/fix-settlement-rounding';

const seedOverview = (): Session => {
  seedActivityQuestionScene();
  seedShellChrome({
    session: ACTIVITY_QUESTION_SESSION,
    siblings: [],
    branches: { [ACTIVITY_QUESTION_SESSION.id]: OVERVIEW_BRANCH },
    telemetryAt: NOW,
    lens: null,
  });
  return ACTIVITY_QUESTION_SESSION;
};

const seedRuns = (): Session => {
  const session = seedC08({ state: 'working', selection: 'list' });
  seedShellChrome({
    session,
    siblings: [],
    branches: {},
    telemetryAt: NOW,
    lens: 'workflows',
  });
  useAppStore.setState({ currentSessionId: session.id });
  return session;
};

const seedRunPage = (): Session => {
  seedWorkflowRun();
  seedShellChrome({
    session: FLOW_SESSION,
    siblings: SESSIONS.filter((session) => session.id !== FLOW_SESSION_ID),
    branches: {},
    telemetryAt: NOW,
    lens: 'workflows',
  });
  return FLOW_SESSION;
};

const SEED: Readonly<Record<PagesPage, () => Session>> = {
  overview: seedOverview,
  runs: seedRuns,
  run: seedRunPage,
};

export const seedPagesPage = ({ page }: PageParams): Session => SEED[page]();
