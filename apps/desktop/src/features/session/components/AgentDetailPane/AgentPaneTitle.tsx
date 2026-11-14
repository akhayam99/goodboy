import type { ReactNode } from 'react';
import type { Agent, Session } from '@goodboy/types';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { useAppStore, useExecutedAgentRouting } from '../../../../store';
import { AGENT_KIND_META, classifyAgent } from '../../agent-kind';
import { executedRoutingOf } from '../../../auto/executedRoutingOf';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { useAgentHeaderRouting } from '../../../../shared/hooks/useAgentHeaderRouting';
import { agentHeadingOf } from './agentHeadingOf';
import { AgentProviderMark } from './AgentProviderMark';
import { AgentTitle } from './AgentTitle';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly brief: string | null;
  readonly runHeading: ReactNode | undefined;
  readonly isInline: boolean;
};

export const AgentPaneTitle = ({ session, agent, brief, runHeading, isInline }: Props) => {
  const kindOverride = useAppStore((state) => state.agentKindOverride[agent.id] ?? null);
  const kind = classifyAgent({ agent, override: kindOverride });
  const isAutoRoot = kind === 'auto';
  const executed = useExecutedAgentRouting({ agent });
  const routing = useAgentHeaderRouting({ session, agent });
  const headerMenu = useObjectMenuTrigger({
    target: { kind: 'agent', sessionId: session.id, agentId: agent.id },
    anchorKey: `agent-header:${agent.id}`,
  });
  const heading = agentHeadingOf({ name: agent.name, kind, brief });
  const isChipShown = !isAutoRoot && heading !== brief && heading !== AGENT_KIND_META[kind].noun;
  const shownRouting = executedRoutingOf({ executed, fallback: routing });
  return (
    <span
      className="flex min-w-0 items-center gap-2"
      onContextMenu={headerMenu.onContextMenu}
      onKeyDown={headerMenu.onKeyDown}
    >
      {runHeading === undefined ? (
        <>
          {isChipShown ? <AgentKindChip kind={kind} /> : null}
          <AgentTitle agent={agent} sessionId={session.id} brief={brief} isInline={isInline} />
        </>
      ) : (
        runHeading
      )}
      {isAutoRoot ? null : <AgentProviderMark provider={shownRouting.provider} />}
    </span>
  );
};
