import { useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Divider, Popover, ScrollFade, StatusDot, cn, useDropdown } from '@goodboy/ui';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useCurrentSession,
  useSessionStageInfo,
} from '../../../../store';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import type { BreadcrumbCrumb } from '../../../../app/components/AppBreadcrumb/buildBreadcrumb';
import { STAGE_TONE } from '../../session-stage';
import { useSessionCrumbs } from '../../hooks/useSessionCrumbs';
import { agentHomeLens, classifyAgent, type AgentHomeLens } from '../../agent-kind';
import { isAgentFinished } from '../../agent-lifecycle';
import { useResolverIndex } from '../../hooks/useResolverIndex';
import type { ResolverStatus } from '../../resolver-linkage';
import { CRUMB_BUTTON_CLASS, CRUMB_LAST_CLASS, CRUMB_LINK_CLASS } from './crumbClasses';
import { PlainCrumb } from './PlainCrumb';
import { AgentSwitcherCrumb } from './AgentSwitcherCrumb';
import type { SwitcherEntry } from './switcherEntry';

type SessionCrumbsProps = {
  readonly session: Session;
};

const SessionCrumbs = ({ session }: SessionCrumbsProps) => {
  const sessionId = session.id as SessionId;
  const crumbs = useSessionCrumbs({ session });
  const stage = useSessionStageInfo(session);
  const selectedAgentId = useAppStore(
    (state) => state.selectedAgentId[sessionId] ?? null,
  ) as AgentId | null;
  const phaseRuns = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const agentKindOverride = useAppStore((state) => state.agentKindOverride);
  const selectAgent = useAppStore((state) => state.selectAgent);
  const resolverIndex = useResolverIndex(sessionId);
  const resolverStatusByAgentId = useMemo(() => {
    const map = new Map<AgentId, ResolverStatus>();
    for (const link of resolverIndex.links) {
      map.set(link.agent.id, link.status);
    }
    return map;
  }, [resolverIndex]);

  const selectedAgent = useMemo(
    () => phaseRuns.find((agent) => agent.id === selectedAgentId) ?? null,
    [phaseRuns, selectedAgentId],
  );

  const selectedAgentHome: AgentHomeLens | null = useMemo(() => {
    if (selectedAgent == null) {
      return null;
    }
    return agentHomeLens(
      selectedAgent,
      classifyAgent(selectedAgent, agentKindOverride[selectedAgent.id] ?? null),
    );
  }, [selectedAgent, agentKindOverride]);

  const siblings: ReadonlyArray<SwitcherEntry> = useMemo(() => {
    if (selectedAgent == null || selectedAgentHome == null) {
      return EMPTY_ARRAY as ReadonlyArray<SwitcherEntry>;
    }
    return phaseRuns
      .filter((agent) => agent.parentAgentId == null)
      .filter((agent) => {
        const kind = classifyAgent(agent, agentKindOverride[agent.id] ?? null);
        return agentHomeLens(agent, kind) === selectedAgentHome;
      })
      .map((agent) => {
        const kind = classifyAgent(agent, agentKindOverride[agent.id] ?? null);
        const isFinished = isAgentFinished({
          agent,
          resolverStatus: resolverStatusByAgentId.get(agent.id) ?? null,
        });
        return { agent, kind, isFinished };
      })
      .sort((a, b) => b.agent.ordinal - a.agent.ordinal);
  }, [phaseRuns, agentKindOverride, resolverStatusByAgentId, selectedAgent, selectedAgentHome]);

  const isSelectedCrumbAnAgent =
    selectedAgent != null &&
    crumbs.length > 0 &&
    crumbs[crumbs.length - 1]?.id === 'selected-child';
  const canSwitchAgent = isSelectedCrumbAnAgent && siblings.length > 1;

  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className="flex h-8 min-w-0 shrink-0 items-center gap-1.5 bg-background px-4"
      >
        <StatusDot tone={STAGE_TONE[stage.stage]} size="sm" title={stage.reason} />
        {crumbs.map((crumb, index) => (
          <span key={crumb.id} className="flex min-w-0 items-center gap-1.5">
            {index > 0 ? (
              <ChevronRight size={12} aria-hidden className="shrink-0 text-muted-foreground/40" />
            ) : null}
            {index === crumbs.length - 1 && canSwitchAgent && selectedAgent != null ? (
              <AgentSwitcherCrumb
                sessionId={sessionId}
                label={crumb.label}
                siblings={siblings}
                selectedAgentId={selectedAgent.id}
                onSelect={(id) => {
                  void selectAgent(sessionId, id);
                }}
              />
            ) : (
              <PlainCrumb crumb={crumb} isLast={index === crumbs.length - 1} />
            )}
          </span>
        ))}
      </nav>
      <Divider className="shrink-0" />
    </>
  );
};

export const SessionCrumbBar = () => {
  const currentSession = useCurrentSession();

  if (!currentSession) {
    return null;
  }
  return <SessionCrumbs key={currentSession.id} session={currentSession} />;
};
