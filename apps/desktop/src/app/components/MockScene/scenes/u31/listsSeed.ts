import type { OpenQuestion, Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SESSION, SESSION_ID, seedArtifactScene } from '../artifactSeed';
import {
  ANSWERED_QUESTIONS,
  CHAT_SESSION,
  CHAT_SESSION_ID,
  LENS_QUESTIONS,
  NOW,
  SESSIONS,
} from '../flow-audit/fixtures';
import { seedChatSurfaces } from '../flow-audit/seeds';
import { seedShellChrome } from '../shellChrome';

export type ListsPage = 'questions' | 'artifacts' | 'card';

type PageParams = {
  readonly page: ListsPage;
};

export type ListsSeeded = {
  readonly session: Session;
  readonly sessionId: SessionId;
  readonly questions: ReadonlyArray<OpenQuestion>;
};

const CARD_QUESTION: OpenQuestion = {
  ...LENS_QUESTIONS[0]!,
  text: 'Should notify-relay resend a webhook that Harborline already acknowledged, or skip it?',
  suggestedAnswers: ['Skip it: one send per event id', 'Send it, marked as a retry', 'Both'],
  recommendedAnswer: 'Skip it: one send per event id',
  selectMode: 'one',
  isBlocking: true,
};

const seedQuestions = (): ListsSeeded => {
  seedChatSurfaces();
  seedShellChrome({
    session: CHAT_SESSION,
    siblings: SESSIONS.filter((session) => session.id !== CHAT_SESSION_ID),
    branches: {},
    telemetryAt: NOW,
    lens: 'questions',
  });
  useAppStore.setState({
    sessionOpenQuestions: { [CHAT_SESSION_ID]: LENS_QUESTIONS },
    sessionAnsweredQuestions: { [CHAT_SESSION_ID]: ANSWERED_QUESTIONS },
    sessionDismissedQuestions: { [CHAT_SESSION_ID]: [] },
    selectedAgentId: {},
    loadSessionOpenQuestions: async () => undefined,
    loadSessionAnsweredQuestions: async () => undefined,
    loadSessionDismissedQuestions: async () => undefined,
  });
  return { session: CHAT_SESSION, sessionId: CHAT_SESSION_ID, questions: LENS_QUESTIONS };
};

const seedArtifacts = (): ListsSeeded => {
  seedArtifactScene({ focusedArtifactId: null, withStates: true });
  seedShellChrome({
    session: SESSION,
    siblings: [],
    branches: {},
    telemetryAt: NOW,
    lens: 'plans',
  });
  return { session: SESSION, sessionId: SESSION_ID, questions: [] };
};

const seedCard = (): ListsSeeded => {
  seedChatSurfaces();
  useAppStore.setState({
    sessionOpenQuestions: { [CHAT_SESSION_ID]: [CARD_QUESTION] },
    sessionAnsweredQuestions: { [CHAT_SESSION_ID]: [] },
    sessionDismissedQuestions: { [CHAT_SESSION_ID]: [] },
    selectedAgentId: {},
    loadSessionOpenQuestions: async () => undefined,
    loadSessionAnsweredQuestions: async () => undefined,
    loadSessionDismissedQuestions: async () => undefined,
  });
  return { session: CHAT_SESSION, sessionId: CHAT_SESSION_ID, questions: [CARD_QUESTION] };
};

const SEED: Readonly<Record<ListsPage, () => ListsSeeded>> = {
  questions: seedQuestions,
  artifacts: seedArtifacts,
  card: seedCard,
};

export const seedListsPage = ({ page }: PageParams): ListsSeeded => SEED[page]();
