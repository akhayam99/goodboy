import { useEffect, useState } from 'react';
import { QuestionsPane } from '../../../../../features/session/components/SessionWorkspace/parts/QuestionsPane';
import { useAppStore } from '../../../../../store';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import {
  ANSWERED_QUESTIONS,
  CHAT_SESSION,
  CHAT_SESSION_ID,
  NOW,
  OPEN_QUESTIONS,
  QUESTION_SIGNALS_ID,
  SESSIONS,
} from './fixtures';
import { seedChatSurfaces } from './seeds';

export const OpenQuestionsScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedChatSurfaces();
    seedShellChrome({
      session: CHAT_SESSION,
      siblings: SESSIONS.filter((session) => session.id !== CHAT_SESSION_ID),
      branches: {},
      telemetryAt: NOW,
      lens: 'questions',
    });
    useAppStore.setState({
      sessionOpenQuestions: {
        [CHAT_SESSION_ID]: OPEN_QUESTIONS.filter((question) => question.id === QUESTION_SIGNALS_ID),
      },
      sessionAnsweredQuestions: { [CHAT_SESSION_ID]: ANSWERED_QUESTIONS },
      sessionDismissedQuestions: { [CHAT_SESSION_ID]: [] },
      selectedAgentId: {},
      loadSessionOpenQuestions: async () => undefined,
      loadSessionAnsweredQuestions: async () => undefined,
      loadSessionDismissedQuestions: async () => undefined,
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return <ShellFrame session={CHAT_SESSION} main={<QuestionsPane session={CHAT_SESSION} />} />;
};
