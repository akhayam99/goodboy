import { Button, WorkNode, type WorkNodeState } from '@goodboy/ui';
import type { Agent, AgentStatus, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { classifyAgent } from '../../agent-kind';
import { describeAgentStatus } from '../../agent-status';

type Props = {
  readonly sessionId: SessionId;
  readonly agents: ReadonlyArray<Agent>;
};

const NODE_STATE: Record<AgentStatus, WorkNodeState> = {
  pending: 'queued',
  running: 'running',
  completed: 'done',
  failed: 'failed',
  blocked: 'alert',
  skipped: 'skipped',
  stopped: 'stopped',
};

export const DelegationLines = ({ sessionId, agents }: Props) => {
  const overrides = useAppStore((state) => state.agentKindOverride);
  const openDrawer = useAppStore((state) => state.openDrawer);
  if (agents.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Delegations" className="flex flex-col gap-1">
      {agents.map((child) => {
        const kind = classifyAgent({ agent: child, override: overrides[child.id] ?? null });
        const word = describeAgentStatus({ status: child.status }).label;
        return (
          <li
            key={child.id}
            data-delegation={child.id}
            className="flex h-7 min-w-0 items-center gap-2 text-label"
          >
            <span className="flex size-5 shrink-0 items-center justify-center">
              <WorkNode
                size="sm"
                state={NODE_STATE[child.status]}
                mark={{ kind: 'dot' }}
                label={word}
              />
            </span>
            <span className="shrink-0 text-muted-foreground">Delegated to</span>
            <AgentKindChip kind={kind} />
            <Button
              variant="quiet"
              size="xs"
              aria-label={`See more about ${child.name}`}
              onClick={() =>
                openDrawer({ kind: 'transcript', sessionId, payload: { agentId: child.id } })
              }
            >
              See more
            </Button>
          </li>
        );
      })}
    </ul>
  );
};
