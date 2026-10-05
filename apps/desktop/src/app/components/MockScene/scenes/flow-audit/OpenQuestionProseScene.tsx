import { useEffect, useState } from 'react';
import { QuestionsPane } from '../../../../../features/session/components/SessionWorkspace/parts/QuestionsPane';
import {
  PERSON_ANSWERS,
  useOpenQuestions,
} from '../../../../../features/context/components/QuestionsTab/useOpenQuestions';
import { useAppStore } from '../../../../../store';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import { CHAT_SESSION, CHAT_SESSION_ID, NOW, PROSE_QUESTION, SESSIONS } from './fixtures';
import { seedChatSurfaces } from './seeds';

export const OpenQuestionProseScene = () => {
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
    useOpenQuestions.setState({
      drafts: {
        [PROSE_QUESTION.id]: {
          selectedSuggestions: [],
          customAnswer: 'Not yet. I left a note on a line of the diff, read it first.',
          showCustomField: true,
          answerIntent: PERSON_ANSWERS,
        },
      },
      staged: [],
    });
    useAppStore.setState({
      sessionOpenQuestions: { [CHAT_SESSION_ID]: [PROSE_QUESTION] },
      sessionAnsweredQuestions: { [CHAT_SESSION_ID]: [] },
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
