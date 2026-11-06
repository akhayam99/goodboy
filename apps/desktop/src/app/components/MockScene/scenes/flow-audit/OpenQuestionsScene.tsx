import { useEffect, useState } from 'react';
import type { OpenQuestionId } from '@goodboy/types';
import { QuestionsPane } from '../../../../../features/session/components/SessionWorkspace/parts/QuestionsPane';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { questionPlace, useAppStore } from '../../../../../store';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import {
  ANSWERED_QUESTIONS,
  CHAT_SESSION,
  CHAT_SESSION_ID,
  LENS_QUESTIONS,
  NOW,
  SESSIONS,
} from './fixtures';
import { seedChatSurfaces } from './seeds';

type Props = {
  readonly drawerQuestionId?: OpenQuestionId | null;
  readonly theme?: 'light' | 'dark';
};

export const OpenQuestionsScene = ({ drawerQuestionId = null, theme }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (theme !== undefined) {
      applyDocumentTheme({ theme });
    }
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
        [CHAT_SESSION_ID]: LENS_QUESTIONS,
      },
      sessionAnsweredQuestions: { [CHAT_SESSION_ID]: ANSWERED_QUESTIONS },
      sessionDismissedQuestions: { [CHAT_SESSION_ID]: [] },
      selectedAgentId: {},
      loadSessionOpenQuestions: async () => undefined,
      loadSessionAnsweredQuestions: async () => undefined,
      loadSessionDismissedQuestions: async () => undefined,
    });
    if (drawerQuestionId !== null) {
      const { navigate } = useAppStore.getInitialState();
      useAppStore.setState({ navigate });
      navigate({
        to: questionPlace({ sessionId: CHAT_SESSION_ID, questionId: drawerQuestionId }),
      });
    }
    setIsReady(true);
  }, [drawerQuestionId, theme]);

  if (!isReady) {
    return null;
  }

  return <ShellFrame session={CHAT_SESSION} main={<QuestionsPane session={CHAT_SESSION} />} />;
};
