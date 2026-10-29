import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { PROVIDER_CAPABILITIES, isAutoOwnProvider, type ResolveSlot } from '@goodboy/core';
import type { EffortLevel, ProviderId, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectModelContext } from '../../../../store/runtime/models/selectModelContext';
import { resolutionOf } from '../../../../store/runtime/models/selectResolution';
import { selectKindRouting } from '../../../../store/slices/agents/selectKindRouting';
import { selectWorkspaceKindRouting } from '../../../../store/slices/agents/selectWorkspaceKindRouting';
import { SETTING_HIDDEN_MODELS } from '../../../settings/settings';
import type { RunModelSlot } from '../../startRun/runModelSlotOf';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly slot: RunModelSlot;
};

export type RunModelRouting = Readonly<{
  provider: ProviderId;
  model: string;
  effort: EffortLevel;
}>;

export type RunModelDefault = Readonly<{
  suggestion: RunModelRouting;
  connectedProviders: ReadonlyArray<ProviderId>;
}>;

const ORCHESTRATOR_TASK: ResolveSlot = { kind: 'task', id: 'workflow_orchestrator' };

const DEFAULT_EFFORT: EffortLevel = 'medium';

export const useRunModelDefault = ({ workspaceId, sessionId, slot }: Params): RunModelDefault => {
  const providers = useAppStore((state) => state.providers);
  const providerLimits = useAppStore((state) => state.providerLimits);
  const hiddenRaw = useAppStore((state) => state.settings?.[SETTING_HIDDEN_MODELS]);
  const cliRequirements = useAppStore((state) => state.cliRequirements);
  const workspaceOverride = useAppStore((state) => state.workspaceOverrides?.[workspaceId]);
  const sessionOverride = useAppStore((state) =>
    sessionId === null ? undefined : state.sessionOverrides?.[sessionId],
  );
  const activeProjectId = useAppStore((state) =>
    sessionId === null ? undefined : state.sessionActiveProject?.[sessionId],
  );
  const projects = useAppStore((state) => state.projects);
  const sessions = useAppStore((state) => state.sessions);
  const agentKind = slot.kind === 'agent' ? slot.agentKind : null;
  const orchestrator = useMemo(
    () =>
      resolutionOf({
        scope: selectModelContext({
          state: {
            providers,
            providerLimits,
            settings: hiddenRaw === undefined ? {} : { [SETTING_HIDDEN_MODELS]: hiddenRaw },
            cliRequirements,
            workspaceOverrides:
              workspaceOverride === undefined ? {} : { [workspaceId]: workspaceOverride },
            sessionOverrides:
              sessionId === null || sessionOverride === undefined
                ? {}
                : { [sessionId]: sessionOverride },
            projects,
            sessions,
            sessionActiveProject:
              sessionId === null || activeProjectId === undefined
                ? {}
                : { [sessionId]: activeProjectId },
          },
          sessionId,
          workspaceId,
        }),
        slot: ORCHESTRATOR_TASK,
      }),
    [
      activeProjectId,
      cliRequirements,
      hiddenRaw,
      projects,
      providerLimits,
      providers,
      sessionId,
      sessionOverride,
      sessions,
      workspaceId,
      workspaceOverride,
    ],
  );
  const agentRouting = useAppStore(
    useShallow((state) => {
      if (agentKind === null) {
        return null;
      }
      return sessionId === null
        ? selectWorkspaceKindRouting({ state, workspaceId, kind: agentKind })
        : selectKindRouting({ state, sessionId, kind: agentKind });
    }),
  );
  const connectedProviders = useMemo(
    () =>
      providers
        .filter((provider) => provider.connection === 'connected')
        .map((provider) => provider.id)
        .filter((id) => PROVIDER_CAPABILITIES[id].models.length > 0)
        .filter((id) => agentKind !== 'auto' || isAutoOwnProvider({ provider: id })),
    [agentKind, providers],
  );
  const suggestion = useMemo(
    (): RunModelRouting =>
      agentRouting === null
        ? {
            provider: orchestrator.provider,
            model: orchestrator.model,
            effort: orchestrator.effort ?? DEFAULT_EFFORT,
          }
        : {
            provider: agentRouting.provider,
            model: agentRouting.model,
            effort: agentRouting.effort,
          },
    [agentRouting, orchestrator],
  );
  return { suggestion, connectedProviders };
};
