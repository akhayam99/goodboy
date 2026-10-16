import type { Agent, AgentStatus, Session } from '@goodboy/types';
import { Chip } from '@goodboy/ui';
import { useAutoTreeViews } from '../../../auto/useAutoTreeViews';
import { AgentStatusBadge } from '../AgentTree/AgentStatusBadge';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly status: AgentStatus;
};

export const AgentAutoStatus = ({ session, agent, status }: Props) => {
  const views = useAutoTreeViews({ sessionId: session.id });
  const phase = views.find((view) => view.tree.rootAgentId === agent.id)?.tree.phase ?? null;
  if (status !== 'running' && phase === 'done') {
    return <Chip tone="neutral" kind="state" bordered={false} label="Idle" className="shrink-0" />;
  }
  if (status !== 'running' && phase === 'finished') {
    return (
      <Chip tone="success" kind="state" bordered={false} label="Finished" className="shrink-0" />
    );
  }
  return <AgentStatusBadge status={status} />;
};
