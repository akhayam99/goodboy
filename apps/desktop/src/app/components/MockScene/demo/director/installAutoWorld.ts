import { brandId, type ProviderRunId, type TurnEvent } from '@goodboy/types';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import { AUTO_SESSION, IMPLEMENTER_ID, TESTER_ID } from '../../scenes/u24/autoSceneSeed';
import { AUTO_STORY, LEDGER_ID, ORCHESTRATE_GOAL } from './autoStory';
import type { DirectorStore } from './directorTypes';
import { installStoryWorld } from './installStoryWorld';

type Params = {
  readonly store: DirectorStore;
};

type BriefParams = {
  readonly runId: string;
  readonly text: string;
};

const briefOf = ({ runId, text }: BriefParams): TurnEvent => ({
  kind: 'user_text',
  runId: brandId<ProviderRunId>({ value: `demo-brief-${runId}` }),
  text,
  at: nowIso({}),
  deliveredBy: 'auto',
});

export const installAutoWorld = ({ store }: Params): void => {
  const sessionId = AUTO_SESSION.id;
  installStoryWorld({ store, sessionId });
  store.setState((current) => ({
    sessions: current.sessions.map((session) =>
      session.id === sessionId ? { ...session, goal: ORCHESTRATE_GOAL } : session,
    ),
    sessionWorkflows: { ...current.sessionWorkflows, [sessionId]: [] },
    transcripts: {
      ...current.transcripts,
      [IMPLEMENTER_ID]: [briefOf({ runId: 'implementer', text: AUTO_STORY.implementerTask })],
      [TESTER_ID]: [briefOf({ runId: 'tester', text: AUTO_STORY.testerTask })],
      [LEDGER_ID]: [briefOf({ runId: 'ledger', text: AUTO_STORY.ledgerTask })],
    },
  }));
};
