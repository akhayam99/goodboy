import { useMemo } from 'react';
import { StatusDot, Tooltip, Trail, type TrailSegmentModel } from '@goodboy/ui';
import type { Agent, AgentId, ResolveAttempt, Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionStageInfo, agentPlace } from '../../../../store';
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
import { AgentSwitcherCrumb } from './AgentSwitcherCrumb';
import { LensSwitcherCrumb } from './LensSwitcherCrumb';
import { switcherPeers } from './switcherPeers';
import type { SwitcherEntry } from './switcherEntry';

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
  const setFocusedArtifactId = useAppStore((state) => state.setFocusedArtifactId);
  const setFocusedWorkflowRun = useAppStore((state) => state.setFocusedWorkflowRun);
  const phaseRuns = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const agentKindOverride = useAppStore((state) => state.agentKindOverride);
  const navigate = useAppStore((state) => state.navigate);
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

  const segments: ReadonlyArray<TrailSegmentModel> = crumbs.map((crumb, index) => {
    const isLast = index === crumbs.length - 1;
    const accessory =
      isLast && crumb.id === 'selected-child' && selectedAgent != null ? (
        <AgentStatusIcon status={selectedAgent.status} />
      ) : (
        crumb.accessory
      );
    const render: TrailSegmentModel['render'] =
      isLast && canSwitchAgent && selectedAgent != null
        ? ({ isIconOnly }) => (
            <AgentSwitcherCrumb
              label={crumb.label}
              icon={crumb.icon}
              {...(crumb.iconClassName !== undefined && { iconClassName: crumb.iconClassName })}
              accessory={accessory}
              isIconOnly={isIconOnly}
              siblings={siblings}
              selectedAgentId={selectedAgent.id}
              onSelect={(id) => {
                navigate({ to: agentPlace({ sessionId, agentId: id }) });
              }}
            />
          )
        : crumb.id === 'selected-parent' && parentAgent != null && parentSiblings.length > 1
          ? ({ isIconOnly }) => (
              <AgentSwitcherCrumb
                label={crumb.label}
                icon={crumb.icon}
                {...(crumb.iconClassName !== undefined && { iconClassName: crumb.iconClassName })}
                accessory={accessory}
                isIconOnly={isIconOnly}
                siblings={parentSiblings}
                selectedAgentId={parentAgent.id}
                onNavigate={crumb.onClick}
                onSelect={(id) => {
                  navigate({ to: agentPlace({ sessionId, agentId: id }) });
                }}
              />
            )
          : index === destinationCrumbIndex
            ? ({ isIconOnly }) => (
                <LensSwitcherCrumb
                  label={crumb.label}
                  icon={crumb.icon}
                  accessory={accessory}
                  isIconOnly={isIconOnly}
                  sessionId={sessionId}
                  activeLens={activeLens}
                  isBranchless={isBranchless}
                  onNavigate={crumb.onClick}
                  onSelect={(lens) => {
                    setFocusedArtifactId(sessionId, null);
                    setFocusedWorkflowRun(sessionId, null);
                    openLens({ sessionId, lens });
                  }}
                />
              )
            : undefined;
    return {
      id: crumb.id,
      label: crumb.label,
      icon: crumb.icon,
      ...(crumb.iconClassName !== undefined && { iconClassName: crumb.iconClassName }),
      accessory,
      ...(crumb.onClick !== undefined && { onSelect: crumb.onClick }),
      ...(render !== undefined && { render }),
    };
  });

  return (
    <Trail
      segments={segments}
      lead={
        <Tooltip content={stateDescription({ presentation: stagePresentation })}>
          <span className="inline-flex shrink-0 items-center">
            <StatusDot
              tone={stagePresentation.tone}
              size="sm"
              ariaLabel={stateDescription({ presentation: stagePresentation })}
            />
          </span>
        </Tooltip>
      }
    />
  );
};
