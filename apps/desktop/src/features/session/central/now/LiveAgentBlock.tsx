import { useContext, type ReactNode } from 'react';
import { ROW_INTERACTIVE, cn } from '@goodboy/ui';
import type { MeasuredTurnSpan, SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { DelegationClock } from '../../../auto/chat/DelegationClock';
import { rowStateShortSentence } from '../../../workTreeModel/rowStateCopy';
import { WorkTimeContext } from '../../../workTreeModel/workTimeSource';
import { AGENT_KIND_META } from '../../agent-kind';
import { agentModelLineOf } from './agentModelLineOf';
import { LiveChildLine } from './LiveChildLine';
import type { LiveAgentGroup } from './liveGroupsOf';

type Props = {
  readonly sessionId: SessionId;
  readonly group: LiveAgentGroup;
  readonly chip?: ReactNode;
};

const NO_SPANS: ReadonlyArray<MeasuredTurnSpan> = [];

export const LiveAgentBlock = ({ sessionId, group, chip }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const { agent, agentKind } = group.entry;
  const word = rowStateShortSentence({ state: group.rowState }) ?? 'Working';
  const source = useContext(WorkTimeContext);
  const detail = agentModelLineOf({
    agent,
    spans: source?.spans ?? NO_SPANS,
    isLive: group.rowState.phase === 'running',
  });
  return (
    <section
      aria-label={group.title}
      data-live-group="agent"
      data-state={group.state}
      className="flex min-w-0 flex-col gap-1"
    >
      <button
        type="button"
        aria-label={`Open ${group.title}`}
        onClick={() => navigate({ to: agentPlace({ sessionId, agentId: agent.id }) })}
        className={cn(
          'flex min-w-0 items-center gap-2 rounded-md px-1 py-1 text-left',
          ROW_INTERACTIVE,
        )}
      >
        <AgentKindChip kind={agentKind} density="glyph" isDecorative />
        <span className="shrink-0 text-label text-foreground">
          {AGENT_KIND_META[agentKind].noun}
        </span>
        <span className="min-w-0 flex-1 truncate text-label text-muted-foreground">
          {group.title}
        </span>
        {chip}
        <span className="shrink-0 text-label text-muted-foreground">{word}</span>
        {detail === null ? null : (
          <span className="shrink-0 text-meta text-faint-foreground">{detail}</span>
        )}
        <DelegationClock agentId={agent.id} isLive={group.rowState.phase === 'running'} />
      </button>
      {group.children.length === 0 ? null : (
        <ul aria-label="Running now" className="flex min-w-0 list-none flex-col gap-0.5">
          {group.children.map((child) => (
            <LiveChildLine key={child.agentId} child={child} />
          ))}
        </ul>
      )}
    </section>
  );
};
