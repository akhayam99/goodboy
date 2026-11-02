import { useEffect, useState } from 'react';
import { ChatView } from '../../../../../features/chat/components/ChatView';
import { useAppStore } from '../../../../../store';
import {
  LONG_TRANSCRIPT_AGENT,
  LONG_TRANSCRIPT_AGENT_ID,
  LONG_TRANSCRIPT_PROJECTS,
  LONG_TRANSCRIPT_ROWS,
  LONG_TRANSCRIPT_SESSION,
  LONG_TRANSCRIPT_SESSION_ID,
  LONG_TRANSCRIPT_WORKSPACE,
  LONG_TRANSCRIPT_WORKSPACE_ID,
  longTranscriptRows,
} from './longTranscriptSeed';

type Props = {
  readonly rowCount?: number;
};

export const LongTranscriptScene = ({ rowCount = LONG_TRANSCRIPT_ROWS }: Props) => {
  const [isSeeded, setIsSeeded] = useState(false);

  useEffect(() => {
    useAppStore.setState({
      workspaces: [LONG_TRANSCRIPT_WORKSPACE],
      currentWorkspaceId: LONG_TRANSCRIPT_WORKSPACE_ID,
      projects: LONG_TRANSCRIPT_PROJECTS,
      sessions: [LONG_TRANSCRIPT_SESSION],
      currentSessionId: LONG_TRANSCRIPT_SESSION_ID,
      selectedAgentId: { [LONG_TRANSCRIPT_SESSION_ID]: LONG_TRANSCRIPT_AGENT_ID },
      sessionPhaseRuns: { [LONG_TRANSCRIPT_SESSION_ID]: [LONG_TRANSCRIPT_AGENT] },
      transcripts: { [LONG_TRANSCRIPT_AGENT_ID]: longTranscriptRows({ count: rowCount }) },
      sessionEvents: { [LONG_TRANSCRIPT_SESSION_ID]: [] },
      sessionProjectMounts: { [LONG_TRANSCRIPT_SESSION_ID]: [] },
      sessionOpenQuestions: { [LONG_TRANSCRIPT_SESSION_ID]: [] },
      sessionAnsweredQuestions: { [LONG_TRANSCRIPT_SESSION_ID]: [] },
      sessionDismissedQuestions: { [LONG_TRANSCRIPT_SESSION_ID]: [] },
      sessionLoading: {
        [LONG_TRANSCRIPT_SESSION_ID]: {
          agents: false,
          transcript: false,
          telemetry: false,
          slots: false,
          plans: false,
          summary: false,
        },
      },
      loadSessionEvents: async () => undefined,
      loadSessionOpenQuestions: async () => undefined,
      loadSessionAnsweredQuestions: async () => undefined,
      loadSessionDismissedQuestions: async () => undefined,
      loadAgentTranscript: async () => undefined,
      navigate: () => undefined,
      markAgentViewed: async () => undefined,
      refreshProviders: async () => undefined,
      recordSessionEvent: async () => undefined,
    });
    setIsSeeded(true);
  }, [rowCount]);

  if (!isSeeded) {
    return null;
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      <ChatView session={LONG_TRANSCRIPT_SESSION} />
    </div>
  );
};
