import { Fragment, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { StatusDot, Tooltip, cn } from '@goodboy/ui';
import type { Agent, AgentId, ResolveAttempt, Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionStageInfo } from '../../../../store';
import { describeSessionStage } from '../../session-stage';
import { stateDescription } from '../../../../shared/utils/statePresentation';
import { useSessionCrumbs } from '../../hooks/useSessionCrumbs';
import { useIsBranchlessSession } from '../../hooks/useIsBranchlessSession';
import { openLens } from '../../openLens';
import { supportedLens } from '../../supportedLens';
import { agentHomeLens, classifyAgent, resolveRootAgent } from '../../agent-kind';
import { isAgentFinished } from '../../agent-lifecycle';
import { useAgentLifecycleSignals } from '../../hooks/useAgentLifecycleSignals';
import { settledResolverAgentIds } from '../../../review/settledResolverAgentIds';
import { AgentStatusIcon } from '../AgentCard/AgentStatusIcon';
import { PlainCrumb } from './PlainCrumb';
import { AgentSwitcherCrumb } from './AgentSwitcherCrumb';
import { LensSwitcherCrumb } from './LensSwitcherCrumb';
import { switcherPeers } from './switcherPeers';
import { CollapsedCrumbs } from './CollapsedCrumbs';
import type { SwitcherEntry } from './switcherEntry';

import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

const EMPTY_ATTEMPTS: ReadonlyArray<ResolveAttempt> = [];

type SessionCrumbsProps = {
  readonly session: Session;
};

export const SessionCrumbs = ({ session }: SessionCrumbsProps) => {
  const sessionId = session.id as SessionId;
  const crumbs = useSessionCrumbs({ session });
  const stage = useSessionStageInfo(session);
  const stagePresentation = describeSessionStage(stage);
  const selectedAgentId = useAppStore(
    (state) => state.selectedAgentId[sessionId] ?? null,
  ) as AgentId | null;
  const storedActiveLens = useAppStore((state) => state.activeLens[sessionId] ?? null);
  const isBranchless = useIsBranchlessSession({ session });
  const activeLens = supportedLens({ lens: storedActiveLens, isBranchless });
  const setFocusedPlanId = useAppStore((state) => state.setFocusedPlanId);
  const setFocusedArtifactId = useAppStore((state) => state.setFocusedArtifactId);
  const setFocusedWorkflowRun = useAppStore((state) => state.setFocusedWorkflowRun);
  const phaseRuns = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const agentKindOverride = useAppStore((state) => state.agentKindOverride);
  const selectAgent = useAppStore((state) => state.selectAgent);
  const resolveAttempts = useAppStore(
    (state) => state.sessionResolveAttempts[sessionId] ?? EMPTY_ATTEMPTS,
  );
  const settledResolvers = useMemo(
    () => settledResolverAgentIds({ attempts: resolveAttempts }),
    [resolveAttempts],
  );
  const signals = useAgentLifecycleSignals({ sessionId });
  const activeParentIds = useMemo(
    () =>
      new Set(
        phaseRuns.flatMap((agent) =>
          agent.parentAgentId != null && (agent.status === 'pending' || agent.status === 'running')
            ? [agent.parentAgentId]
            : [],
        ),
      ),
    [phaseRuns],
  );

  const selectedAgent = useMemo(
    () => phaseRuns.find((agent) => agent.id === selectedAgentId) ?? null,
    [phaseRuns, selectedAgentId],
  );
  const rootAgent = useMemo(() => {
    if (selectedAgentId == null) {
      return null;
    }
    return resolveRootAgent({ agents: phaseRuns, agentId: selectedAgentId });
  }, [phaseRuns, selectedAgentId]);

  const parentAgent = useMemo(() => {
    const parentId = selectedAgent?.parentAgentId ?? null;
    if (parentId == null) {
      return null;
    }
    return phaseRuns.find((agent) => agent.id === parentId) ?? null;
  }, [phaseRuns, selectedAgent]);

  const toEntries = useMemo(() => {
    const kindOf = (agent: Agent) =>
      classifyAgent({ agent, override: agentKindOverride[agent.id] ?? null });
    return (peers: ReadonlyArray<Agent>): ReadonlyArray<SwitcherEntry> =>
      peers.map((agent) => ({
        agent,
        kind: kindOf(agent),
        isFinished: isAgentFinished({
          agent,
          hasOpenQuestion: signals.openQuestionAgentIds.has(agent.id),
          isTurnLive: signals.liveTurnAgentIds.has(agent.id),
          hasActiveChild: activeParentIds.has(agent.id),
          isResolverSettled: settledResolvers.has(agent.id),
        }),
      }));
  }, [agentKindOverride, settledResolvers, signals, activeParentIds]);

  const siblings: ReadonlyArray<SwitcherEntry> = useMemo(() => {
    if (selectedAgent == null || rootAgent == null) {
      return EMPTY_ARRAY as ReadonlyArray<SwitcherEntry>;
    }
    const kindOf = (agent: Agent) =>
      classifyAgent({ agent, override: agentKindOverride[agent.id] ?? null });
    return toEntries(
      switcherPeers({
        agents: phaseRuns,
        selectedAgent,
        rootAgent,
        home: agentHomeLens({ agent: rootAgent, kind: kindOf(rootAgent) }),
        kindOf,
      }),
    );
  }, [phaseRuns, agentKindOverride, toEntries, selectedAgent, rootAgent]);

  const parentSiblings: ReadonlyArray<SwitcherEntry> = useMemo(() => {
    if (parentAgent == null || rootAgent == null) {
      return EMPTY_ARRAY as ReadonlyArray<SwitcherEntry>;
    }
    const kindOf = (agent: Agent) =>
      classifyAgent({ agent, override: agentKindOverride[agent.id] ?? null });
    return toEntries(
      switcherPeers({
        agents: phaseRuns,
        selectedAgent: parentAgent,
        rootAgent,
        home: agentHomeLens({ agent: rootAgent, kind: kindOf(rootAgent) }),
        kindOf,
      }),
    );
  }, [phaseRuns, agentKindOverride, toEntries, parentAgent, rootAgent]);

  const lastCrumb = crumbs[crumbs.length - 1];
  const isSelectedCrumbAnAgent = selectedAgent != null && lastCrumb?.id === 'selected-child';
  const canSwitchAgent = isSelectedCrumbAnAgent && siblings.length > 1;
  const destinationCrumbIndex = crumbs.length > 1 ? 1 : 0;
  const isCollapsible = (index: number) =>
    index > destinationCrumbIndex && index < crumbs.length - 1;
  const collapsibleCrumbs = crumbs.filter((_, index) => isCollapsible(index));

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex h-6 min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
    >
      <Tooltip content={stateDescription({ presentation: stagePresentation })}>
        <span className="inline-flex shrink-0 items-center">
          <StatusDot
            tone={stagePresentation.tone}
            size="sm"
            ariaLabel={stateDescription({ presentation: stagePresentation })}
          />
        </span>
      </Tooltip>
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        const accessory =
          isLast && crumb.id === 'selected-child' && selectedAgent != null ? (
            <AgentStatusIcon status={selectedAgent.status} />
          ) : (
            crumb.accessory
          );
        const visibleCrumb = accessory === crumb.accessory ? crumb : { ...crumb, accessory };

        return (
          <Fragment key={crumb.id}>
            {index === destinationCrumbIndex + 1 && collapsibleCrumbs.length > 0 ? (
              <CollapsedCrumbs crumbs={collapsibleCrumbs} className="hidden @max-[720px]:flex" />
            ) : null}
            <span
              className={cn(
                'flex min-w-0 items-center gap-1.5',
                isLast ? 'flex-1' : 'shrink',
                isCollapsible(index) && '@max-[720px]:hidden',
              )}
            >
              {index > 0 ? (
                <ChevronRight
                  size={ICON_SIZE.row}
                  aria-hidden
                  className="shrink-0 text-faint-foreground"
                />
              ) : null}
              {index === crumbs.length - 1 && canSwitchAgent && selectedAgent != null ? (
                <AgentSwitcherCrumb
                  label={visibleCrumb.label}
                  icon={visibleCrumb.icon}
                  accessory={visibleCrumb.accessory}
                  siblings={siblings}
                  selectedAgentId={selectedAgent.id}
                  onSelect={(id) => {
                    void selectAgent(sessionId, id);
                  }}
                />
              ) : crumb.id === 'selected-parent' &&
                parentAgent != null &&
                parentSiblings.length > 1 ? (
                <AgentSwitcherCrumb
                  label={visibleCrumb.label}
                  icon={visibleCrumb.icon}
                  accessory={visibleCrumb.accessory}
                  siblings={parentSiblings}
                  selectedAgentId={parentAgent.id}
                  onNavigate={crumb.onClick}
                  onSelect={(id) => {
                    void selectAgent(sessionId, id);
                  }}
                />
              ) : index === destinationCrumbIndex ? (
                <LensSwitcherCrumb
                  label={visibleCrumb.label}
                  icon={visibleCrumb.icon}
                  accessory={visibleCrumb.accessory}
                  sessionId={sessionId}
                  activeLens={activeLens}
                  isBranchless={isBranchless}
                  onNavigate={crumb.onClick}
                  onSelect={(lens) => {
                    setFocusedPlanId(sessionId, null);
                    setFocusedArtifactId(sessionId, null);
                    setFocusedWorkflowRun(sessionId, null);
                    openLens({ sessionId, lens });
                  }}
                />
              ) : (
                <PlainCrumb crumb={visibleCrumb} isLast={isLast} />
              )}
            </span>
          </Fragment>
        );
      })}
    </nav>
  );
};
