import { useMemo } from 'react';
import {
  ActivityMeta,
  ActivityRow,
  Button,
  TruncatedText,
  WorkNode,
  type WorkNodeState,
} from '@goodboy/ui';
import type { Agent, AgentStatus, SessionId, TelemetryRecord } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { useSessionRunHistory } from '../../../../shared/hooks/useSessionRunHistory';
import { autoChildStatusOf } from '../../../auto/autoChildStatusOf';
import { delegationNodeOf } from '../../../auto/chat/delegationNodeOf';
import { DelegationClock } from '../../../auto/chat/DelegationClock';
import { activityStateWordOf } from '../../../workTreeModel/activityStateWordOf';
import { ACTIVITY_TONE_OF_NODE } from '../../../workTreeModel/activityToneOfNode';
import { classifyAgent } from '../../agent-kind';
import { AgentRoleChip } from '../../AgentRoleChip';
import { describeAgentStatus } from '../../agent-status';
import { agentSpendById } from '../../timeline/agentSpendById';

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

const NO_TELEMETRY: ReadonlyArray<TelemetryRecord> = [];

export const DelegationLines = ({ sessionId, agents }: Props) => {
  const overrides = useAppStore((state) => state.agentKindOverride);
  const views = useAppStore((state) => state.autoTreeViews[sessionId]);
  const navigate = useAppStore((state) => state.navigate);
  const telemetry = useAppStore((state) => state.sessionTelemetry[sessionId] ?? NO_TELEMETRY);
  const agentRunHistory = useSessionRunHistory({ sessionId });
  const spendById = useMemo(
    () => agentSpendById({ records: telemetry, agents, agentRunHistory }),
    [telemetry, agents, agentRunHistory],
  );
  if (agents.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Delegations" className="flex flex-col gap-0.5">
      {agents.map((child) => {
        const kind = classifyAgent({ agent: child, override: overrides[child.id] ?? null });
        const status = autoChildStatusOf({ views, agent: child });
        const word = status?.word ?? describeAgentStatus({ status: child.status }).label;
        const node = status === null ? NODE_STATE[child.status] : delegationNodeOf({ status });
        const tone = ACTIVITY_TONE_OF_NODE[node];
        return (
          <li key={child.id} data-delegation={child.id} className="flex h-8 min-w-0 items-center">
            <ActivityRow
              density="feed"
              tone={tone}
              marker={
                <WorkNode look="quiet" size="sm" state={node} mark={{ kind: 'dot' }} label={word} />
              }
              glyph={
                <AgentRoleChip
                  sessionId={sessionId}
                  agentId={child.id}
                  kind={kind}
                  position="Subagent"
                  costUsd={spendById.get(child.id) ?? 0}
                />
              }
              text={
                <TruncatedText className="block" tooltip={child.name}>
                  {child.name}
                </TruncatedText>
              }
              meta={
                <ActivityMeta
                  density="feed"
                  columns={['state', 'time']}
                  state={activityStateWordOf({ tone, word })}
                  time={
                    <DelegationClock
                      agentId={child.id}
                      isLive={node === 'running'}
                      className={node === 'running' ? 'text-info' : undefined}
                    />
                  }
                />
              }
            />
            <Button
              variant="quiet"
              size="xs"
              aria-label={`Open ${child.name}`}
              onClick={() => navigate({ to: agentPlace({ sessionId, agentId: child.id }) })}
            >
              Open
            </Button>
          </li>
        );
      })}
    </ul>
  );
};
