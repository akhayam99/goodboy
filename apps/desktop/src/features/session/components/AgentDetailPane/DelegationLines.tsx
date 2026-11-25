import { Button, TruncatedText, cn, type WorkNodeState } from '@goodboy/ui';
import type { Agent, AgentStatus, SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { autoChildStatusOf } from '../../../auto/autoChildStatusOf';
import { autoTreeOfAgent } from '../../../auto/autoTreeOfAgent';
import { taskTitleOf } from '../../../auto/taskTitleOf';
import { leadTreeInkOf } from '../LeadTree/leadTreeInkOf';
import { delegationNodeOf } from '../../../auto/chat/delegationNodeOf';
import { AGENT_KIND_META, classifyAgent } from '../../agent-kind';
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
  const views = useAppStore((state) => state.autoTreeViews[sessionId]);
  const navigate = useAppStore((state) => state.navigate);
  if (agents.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Delegations" className="flex flex-col gap-1">
      {agents.map((child) => {
        const kind = classifyAgent({ agent: child, override: overrides[child.id] ?? null });
        const status = autoChildStatusOf({ views, agent: child });
        const word = status?.word ?? describeAgentStatus({ status: child.status }).label;
        const node = status === null ? NODE_STATE[child.status] : delegationNodeOf({ status });
        const tree = autoTreeOfAgent({ views: views ?? [], agentId: child.id });
        const title =
          (tree?.kind === 'child' ? taskTitleOf({ request: tree.delegation.request }) : null) ??
          child.name;
        const role = AGENT_KIND_META[kind].noun;
        const ink = leadTreeInkOf({ node });
        return (
          <li
            key={child.id}
            data-delegation={child.id}
            aria-label={`${role}, ${title}, ${word}`}
            className="flex h-7 min-w-0 items-center gap-2 text-meta"
          >
            <AgentKindChip kind={kind} density="bare" title={role} className={ink.glyph} />
            <TruncatedText className="min-w-0 truncate text-foreground" tooltip={title}>
              {title}
            </TruncatedText>
            <span className={cn('shrink-0', ink.word)}>{word}</span>
            <Button
              variant="quiet"
              size="xs"
              aria-label={`Open ${title}`}
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
