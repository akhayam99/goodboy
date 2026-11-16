import { useContext, useState } from 'react';
import type { Agent, Session } from '@goodboy/types';
import type { QueuedNotes } from '../../../chat/queuedNotes';
import { QueuedNotesReportContext } from '../../../chat/queuedNotesReport';
import type { LeadTreeDataModel } from '../../../auto/tree/LeadTreeData';
import { AgentDetailPane } from '../AgentDetailPane';
import { SessionHeadSlotsContext } from '../../sessionHeadSlotsContext';
import { RunAgentsRail } from '../RunAgentsRail';
import { LeadHeaderWord } from './LeadHeaderWord';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly shownAgent: Agent;
  readonly isChatActive: boolean;
  readonly model: LeadTreeDataModel;
  readonly onBack: () => void;
  readonly onQueuedChange: (queued: QueuedNotes) => void;
};

export const LeadPageBody = ({
  session,
  agent,
  shownAgent,
  isChatActive,
  model,
  onBack,
  onQueuedChange,
}: Props) => {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [ownLead, setOwnLead] = useState<HTMLDivElement | null>(null);
  const slots = useContext(SessionHeadSlotsContext);
  const isRunShown = shownAgent.id === agent.id;
  return (
    <div
      ref={setRoot}
      data-lead-page={agent.id}
      data-shown-agent={shownAgent.id}
      className="flex min-h-0 min-w-0 flex-1"
    >
      {slots === null ? (
        <div ref={setOwnLead} data-lead-rail-host="" className="flex shrink-0 empty:hidden" />
      ) : null}
      <RunAgentsRail
        host={slots?.lead ?? ownLead}
        pane={slots?.frame ?? root}
        sessionId={session.id}
        rootAgentId={agent.id}
        shownAgentId={shownAgent.id}
        items={model.items}
        rootState={model.root}
        onEditNote={model.onEditNote}
        onRemoveNote={model.onRemoveNote}
      />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {isRunShown ? (
          <QueuedNotesReportContext.Provider value={onQueuedChange}>
            <AgentDetailPane
              key={agent.id}
              session={session}
              agent={agent}
              isChatActive={isChatActive}
              onBack={onBack}
              headerState={<LeadHeaderWord sessionId={session.id} rootAgentId={agent.id} />}
            />
          </QueuedNotesReportContext.Provider>
        ) : (
          <AgentDetailPane
            key={shownAgent.id}
            session={session}
            agent={shownAgent}
            isChatActive={isChatActive}
            onBack={onBack}
          />
        )}
      </div>
    </div>
  );
};
