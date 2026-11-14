import { useState } from 'react';
import type { Agent, Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { EMPTY_QUEUED_NOTES } from '../../../chat/emptyQueuedNotes';
import type { QueuedNotes } from '../../../chat/queuedNotes';
import { LeadTreeData } from '../../../auto/tree/LeadTreeData';
import { LeadPageBody } from './LeadPageBody';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly isChatActive: boolean;
  readonly onBack: () => void;
};

export const LeadPage = ({ session, agent, isChatActive, onBack }: Props) => {
  const [queued, setQueued] = useState<QueuedNotes>(EMPTY_QUEUED_NOTES);
  const queue = useAppStore((state) => state.agentQueue[agent.id] ?? EMPTY_ARRAY);
  return (
    <LeadTreeData sessionId={session.id} rootAgentId={agent.id} queue={queue} queued={queued}>
      {(model) => (
        <LeadPageBody
          session={session}
          agent={agent}
          isChatActive={isChatActive}
          model={model}
          onBack={onBack}
          onQueuedChange={setQueued}
        />
      )}
    </LeadTreeData>
  );
};
