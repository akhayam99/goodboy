import { useCallback, useContext, useMemo, useState } from 'react';
import { Button, cn } from '@goodboy/ui';
import { brandId, type Agent, type AgentId, type Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { agentPlace } from '../../../../store/slices/navigation/place';
import type { QueuedNotes } from '../../../chat/queuedNotes';
import { QueuedNotesReportContext } from '../../../chat/queuedNotesReport';
import { AutoSelectAgentContext } from '../../../auto/chat/autoSelectAgentContext';
import type { LeadTreeDataModel } from '../../../auto/tree/LeadTreeData';
import { spawnRecordOf } from '../../../auto/tree/spawnRecordOf';
import { AgentDetailPane } from '../AgentDetailPane';
import { useLeadSelectionStore } from '../../hooks/useLeadSelectionStore';
import { leadAgentCountOf } from '../../../auto/tree/leadAgentCountOf';
import { SessionHeadSlotsContext } from '../../sessionHeadSlotsContext';
import { HeadSlotPortal } from '../HeadSlotPortal';
import { LeadPageRailHead } from './LeadPageRailHead';
import { LeadPageRecord } from './LeadPageRecord';
import { LeadPageTree } from './LeadPageTree';
import { leadLayoutOf } from './leadLayoutOf';
import { usePaneWidth } from './usePaneWidth';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly isChatActive: boolean;
  readonly model: LeadTreeDataModel;
  readonly onBack: () => void;
  readonly onQueuedChange: (queued: QueuedNotes) => void;
};

type OpenTranscriptParams = {
  readonly agentId: string;
};

const TREE_WIDTH_CLASS = 'w-[330px]';

export const LeadPageBody = ({
  session,
  agent,
  isChatActive,
  model,
  onBack,
  onQueuedChange,
}: Props) => {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const slots = useContext(SessionHeadSlotsContext);
  const isInHead = slots !== null;
  const layout = leadLayoutOf({ width: usePaneWidth({ node: slots?.frame ?? root }) });
  const [isAgentsOpen, setIsAgentsOpen] = useState(false);
  const navigate = useAppStore((state) => state.navigate);
  const selectedId = useLeadSelectionStore((state) => state.selectedByLead[agent.id] ?? null);
  const select = useLeadSelectionStore((state) => state.select);
  const { items, delegations } = model;
  const selectedItem = useMemo(
    () =>
      selectedId === null
        ? null
        : (items.find((item) => item.kind === 'agent' && item.agentId === selectedId) ?? null),
    [items, selectedId],
  );
  const record = useMemo(
    () =>
      selectedItem === null || selectedItem.kind !== 'agent'
        ? null
        : spawnRecordOf({
            agentId: selectedItem.agentId,
            number: selectedItem.number,
            delegations,
          }),
    [selectedItem, delegations],
  );
  const onSelect = useCallback(
    (agentId: AgentId) => {
      select({ leadAgentId: agent.id, agentId });
      setIsAgentsOpen(true);
    },
    [agent.id, select],
  );
  const onCloseRecord = useCallback(
    () => select({ leadAgentId: agent.id, agentId: null }),
    [agent.id, select],
  );
  const onOpenTranscript = useCallback(
    ({ agentId }: OpenTranscriptParams) =>
      navigate({
        to: agentPlace({ sessionId: session.id, agentId: brandId<AgentId>({ value: agentId }) }),
      }),
    [navigate, session.id],
  );
  const agentCount = leadAgentCountOf({ items });
  const isNarrow = layout === 'narrow';
  const isWide = layout === 'wide';
  const tree = (
    <LeadPageTree
      items={items}
      selectedAgentId={selectedId}
      onSelect={onSelect}
      onEditNote={model.onEditNote}
      onRemoveNote={model.onRemoveNote}
    />
  );
  const recordPanel =
    record === null ? null : (
      <LeadPageRecord
        record={record}
        hasBackArrow={!isWide}
        onClose={onCloseRecord}
        onOpenTranscript={onOpenTranscript}
      />
    );
  const agentsToggle = isNarrow ? (
    <Button
      variant="ghost"
      size="sm"
      aria-expanded={isAgentsOpen}
      onClick={() => setIsAgentsOpen(!isAgentsOpen)}
    >
      {`Agents ${agentCount}`}
    </Button>
  ) : undefined;

  const rails = isNarrow ? null : (
    <>
      <aside
        aria-label="Agents"
        data-lead-rail=""
        className={cn(
          'flex min-h-0 shrink-0 flex-col bg-background',
          TREE_WIDTH_CLASS,
          isInHead && 'h-full border-l border-border-soft motion-safe:animate-fade-in',
        )}
      >
        {isInHead ? <LeadPageRailHead count={agentCount} /> : null}
        {isWide ? tree : (recordPanel ?? tree)}
      </aside>
      {isWide && recordPanel !== null ? (
        <aside
          aria-label="Record"
          className={cn(
            'flex min-h-0 w-[380px] shrink-0 flex-col bg-background',
            isInHead && 'h-full border-l border-border-soft',
          )}
        >
          {recordPanel}
        </aside>
      ) : null}
    </>
  );

  return (
    <div
      ref={setRoot}
      data-lead-page={agent.id}
      data-layout={layout}
      className="flex min-h-0 min-w-0 flex-1"
    >
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <QueuedNotesReportContext.Provider value={onQueuedChange}>
          <AutoSelectAgentContext.Provider value={onSelect}>
            <AgentDetailPane
              session={session}
              agent={agent}
              isChatActive={isChatActive}
              onBack={onBack}
              {...(agentsToggle !== undefined && { agentsToggle })}
            />
          </AutoSelectAgentContext.Provider>
        </QueuedNotesReportContext.Provider>
        {isNarrow && isAgentsOpen ? (
          <aside
            aria-label="Agents"
            className="absolute inset-0 z-10 flex min-h-0 flex-col bg-background"
          >
            <div className="flex shrink-0 items-center justify-end px-3 pt-3">
              <Button variant="ghost" size="sm" onClick={() => setIsAgentsOpen(false)}>
                Close
              </Button>
            </div>
            {recordPanel ?? tree}
          </aside>
        ) : null}
      </div>
      {isInHead ? <HeadSlotPortal slot="aside">{rails}</HeadSlotPortal> : rails}
    </div>
  );
};
