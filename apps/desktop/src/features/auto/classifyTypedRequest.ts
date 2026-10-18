import { classifyRequest, stepSizeForDifficulty, type ClassifiedRole } from '@goodboy/core';
import type { StepSize, WorkspaceId } from '@goodboy/types';
import { invokeCommand } from '../../shared/lib/invokeCommand';
import { cutAtBoundary } from '../../shared/utils/cutAtBoundary';
import type { AppStore } from '../../store/store';
import { selectResolution } from '../../store/slices/models/selectResolution';
import { selectTaskModel } from '../../store/slices/models/selectTaskModel';
import { liveEnabledProviders } from '../../store/slices/models/liveEnabledProviders';
import { selectHiddenModels } from '../../store/slices/settings/selectHiddenModels';
import { autoRoutableProviders } from '../providers/autoRoutableProviders';
import { routeTaskModel } from '../providers/taskModelRouting';
import { SETTING_CLASSIFY_REQUESTS } from '../settings/settings';
import type { AgentKind, AgentKindRouting } from '../session/agent-kind';

const REQUEST_CAP_CHARS = 4_000;

const KIND_OF_ROLE: Readonly<Record<ClassifiedRole, AgentKind>> = {
  scout: 'scout',
  planner: 'planner',
  investigator: 'debugger',
  reviewer: 'reviewer',
};

export type ClassifiedStart = Readonly<{
  agentKind: AgentKind;
  routing: AgentKindRouting;
}>;

type Params = {
  readonly state: AppStore;
  readonly workspaceId: WorkspaceId;
  readonly goal: string;
  readonly isRoutingPinned: boolean;
};

type RoutingParams = {
  readonly state: AppStore;
  readonly workspaceId: WorkspaceId;
  readonly role: ClassifiedRole;
  readonly size: StepSize | null;
};

const routingOf = ({ state, workspaceId, role, size }: RoutingParams): AgentKindRouting => {
  const resolution = selectResolution({
    state,
    workspaceId,
    slot: { kind: 'role', id: role },
    size,
  });
  return {
    provider: resolution.provider,
    model: resolution.model,
    effort: resolution.effort ?? 'medium',
  };
};

export const classifyTypedRequest = async ({
  state,
  workspaceId,
  goal,
  isRoutingPinned,
}: Params): Promise<ClassifiedStart | null> => {
  if (isRoutingPinned || state.settings[SETTING_CLASSIFY_REQUESTS] !== 'true') {
    return null;
  }
  const text = goal.trim();
  if (text === '') {
    return null;
  }
  const connectedProviders = autoRoutableProviders({ providers: state.providers });
  const taskModel = routeTaskModel({
    taskModel: selectTaskModel({ state, workspaceId, task: 'agent_naming' }),
    connectedProviders,
    enabledProviders: liveEnabledProviders({ state, sessionId: null, workspaceId }) ?? null,
    cooldowns: state.providerCooldowns,
    hidden: selectHiddenModels({ state }),
    nowMs: Date.now(),
  });
  if (taskModel === null || !connectedProviders.includes(taskModel.providerId)) {
    return null;
  }
  const result = await classifyRequest({
    deps: { ...taskModel, invokeFn: invokeCommand },
    text: cutAtBoundary({ text, capChars: REQUEST_CAP_CHARS }).text,
  });
  if (result.kind === 'failed' || result.classification.role === null) {
    return null;
  }
  const { role, difficulty } = result.classification;
  return {
    agentKind: KIND_OF_ROLE[role],
    routing: routingOf({
      state,
      workspaceId,
      role,
      size: stepSizeForDifficulty(difficulty),
    }),
  };
};
