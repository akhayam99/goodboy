import type { Agent, Session } from '@goodboy/types';
import { EmptyLine } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { FinishedRegister } from '../../../../shared/components/FinishedRegister';
import { classifyAgent } from '../../agent-kind';
import { AgentListSkeleton } from './AgentListSkeleton';
import { AgentsGridRow } from './AgentsGridRow';
import { useAgentsGrid } from './useAgentsGrid';

type Props = {
  readonly session: Session;
};

type RowsParams = {
  readonly rows: ReadonlyArray<Agent>;
  readonly isMuted: boolean;
};

const VISIBLE_FINISHED_COUNT = 30;

export const AgentsGrid = ({ session }: Props) => {
  const lane = useAgentsGrid({ session });
  const nowMs = Date.now();
  const hasNoAgents = lane.standaloneAgents.length === 0;

  if (lane.isAgentsLoading && hasNoAgents) {
    return <AgentListSkeleton />;
  }
  if (hasNoAgents) {
    return <EmptyLine icon={CONCEPT_ICONS.agents}>No agents in this session yet.</EmptyLine>;
  }

  const renderRows = ({ rows, isMuted }: RowsParams) => (
    <ul aria-label={isMuted ? 'Finished agents' : 'Agents'} className="flex flex-col">
      {rows.map((run) => (
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
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {lane.activeAgents.length > 0
        ? renderRows({ rows: lane.activeAgents, isMuted: false })
        : null}
      {lane.completedAgents.length > 0 ? (
        <FinishedRegister
          label="Completed"
          count={lane.completedAgents.length}
          visible={renderRows({
            rows: lane.completedAgents.slice(0, VISIBLE_FINISHED_COUNT),
            isMuted: true,
          })}
          earlierCount={Math.max(0, lane.completedAgents.length - VISIBLE_FINISHED_COUNT)}
          earlier={renderRows({
            rows: lane.completedAgents.slice(VISIBLE_FINISHED_COUNT),
            isMuted: true,
          })}
        />
      ) : null}
    </div>
  );
};
