import { useState } from 'react';
import type { Session } from '@goodboy/types';
import { Button, EmptyLine } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useNow } from '../../../../shared/hooks/useNow';
import { classifyAgent } from '../../agent-kind';
import { AgentListSkeleton } from './AgentListSkeleton';
import { AgentsGridRow } from './AgentsGridRow';
import { useAgentsGrid } from './useAgentsGrid';

type Props = {
  readonly session: Session;
};

const VISIBLE_FINISHED_COUNT = 30;

export const AgentsGrid = ({ session }: Props) => {
  const lane = useAgentsGrid({ session });
  const [isEveryFinishedShown, setIsEveryFinishedShown] = useState(false);
  const nowMs = useNow(1_000, lane.activeAgents.length > 0);
  const hasNoAgents = lane.standaloneAgents.length === 0;

  if (lane.isAgentsLoading && hasNoAgents) {
    return <AgentListSkeleton />;
  }
  if (hasNoAgents) {
    return <EmptyLine icon={CONCEPT_ICONS.agents}>No agents in this session yet.</EmptyLine>;
  }

  const finished = isEveryFinishedShown
    ? lane.completedAgents
    : lane.completedAgents.slice(0, VISIBLE_FINISHED_COUNT);
  const isCapped = lane.completedAgents.length > finished.length;
  const rows = [
    ...lane.activeAgents.map((run) => ({ run, isMuted: false })),
    ...finished.map((run) => ({ run, isMuted: true })),
  ];

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ul aria-label="Agents" className="flex flex-col">
        {rows.map(({ run, isMuted }) => (
          <AgentsGridRow
            key={run.id}
            session={session}
            run={run}
            kind={classifyAgent({ agent: run, override: lane.agentKindOverride[run.id] ?? null })}
            nowMs={nowMs}
            isMuted={isMuted}
            onOpen={() => lane.onPickAgent(run.id)}
          />
        ))}
      </ul>
      {isCapped ? (
        <Button
          variant="quiet"
          size="sm"
          className="self-start"
          onClick={() => setIsEveryFinishedShown(true)}
        >
          Show all
        </Button>
      ) : null}
    </div>
  );
};
