import { useEffect, useState } from 'react';
import { brandId } from '@goodboy/types';
import type { Agent, AgentId, TurnEvent } from '@goodboy/types';
import { ChatView } from '../../../../../features/chat/components/ChatView';
import { useAppStore } from '../../../../../store';
import { NOW, SESSION, seedActivityRunScene } from '../activityRunSeed';

type Props = {
  readonly events: ReadonlyArray<TurnEvent>;
};

const AGENT_ID = brandId<AgentId>({ value: 'mock-chat-agent' });

const AGENT: Agent = {
  id: AGENT_ID,
  sessionId: SESSION.id,
  name: 'Export speed up',
  kind: 'implementer',
  status: 'completed',
  ordinal: 1,
  lastFinishedAt: NOW,
  lastViewedAt: NOW,
};

export const TranscriptSceneHost = ({ events }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedActivityRunScene();
    useAppStore.setState({
      sessionPhaseRuns: { [SESSION.id]: [AGENT] },
      selectedAgentId: { [SESSION.id]: AGENT_ID },
      agentPane: { [SESSION.id]: 'transcript' },
      transcripts: { [AGENT_ID]: events },
      loadAgentTranscript: async () => undefined,
      sessionOpenQuestions: { [SESSION.id]: [] },
      sessionAnsweredQuestions: { [SESSION.id]: [] },
      sessionEvents: { [SESSION.id]: [] },
    });
    setIsReady(true);
  }, [events]);

  if (!isReady) {
    return null;
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      <ChatView session={SESSION} />
    </div>
  );
};
