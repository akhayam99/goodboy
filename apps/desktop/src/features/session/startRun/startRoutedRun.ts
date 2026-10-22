import {
  DEFAULT_WORKFLOW_RULES,
  brandId,
  type AgentId,
  type IsoDateTime,
  type SessionId,
  type Workflow,
  type WorkflowId,
} from '@goodboy/types';
import { useAppStore } from '../../../store';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { tauriDatabase } from '../../../shared/lib/db';
import { openAgentRevealEvent } from '../../../shared/utils/openAgentReveal';
import { ORCHESTRATED_WORKFLOW_NAME, uniqueWorkflowName } from '../../workflows/uniqueWorkflowName';
import { presetSnapshotOf } from './presetSnapshotOf';
import type { RunRouteResult } from './runRouteOf';
import { runRoutesKey, writeRunRoute } from './runRoutesSetting';

type Params = {
  readonly sessionId: SessionId;
  readonly result: RunRouteResult;
  readonly findings?: string;
};

export type RoutedRun =
  Readonly<{ kind: 'lead'; agentId: AgentId }> | Readonly<{ kind: 'plan'; workflowId: WorkflowId }>;

export const startRoutedRun = async ({
  sessionId,
  result,
  findings = '',
}: Params): Promise<RoutedRun> => {
  const state = useAppStore.getState();
  const session = sessionById(state.sessions, sessionId);
  if (session === undefined || session === null) {
    throw new Error('This session is no longer here');
  }
  const { ask, preset, role } = result;
  const route = { ...result.route, ask };
  const work = findings === '' ? ask : `${ask}\n\n${findings}`;
  if (route.shape === 'lead') {
    const agentId = await state.spawnAgent(sessionId, {
      kindOverride: role ?? 'auto',
      initialPrompt: work,
      focus: 'agent',
    });
    await writeRunRoute({ db: tauriDatabase, sessionId, agentId, route });
    await useAppStore.getState().loadSetting(runRoutesKey({ sessionId }));
    window.dispatchEvent(openAgentRevealEvent());
    return { kind: 'lead', agentId };
  }
  const workspaceId = session.workspaceId;
  const existing = state.phaseTemplates[workspaceId] ?? [];
  const now = brandId<IsoDateTime>({ value: new Date().toISOString() });
  const workflowId = brandId<WorkflowId>({ value: `wf_run_${crypto.randomUUID()}` });
  const name = uniqueWorkflowName({
    requested: preset === null ? ORCHESTRATED_WORKFLOW_NAME : `Plan from ${preset.name}`,
    existing,
  });
  const process = preset?.processText?.trim() ?? '';
  const workflow: Workflow = {
    id: workflowId,
    workspaceId,
    name,
    description: 'Steps are decided at runtime from the latest results.',
    goal: work,
    ...(process !== '' && { processText: process }),
    steps: [],
    isPreset: false,
    origin: 'orchestrated',
    createdAt: now,
    updatedAt: now,
  };
  await state.savePhaseTemplate(workflow);
  const rules = state.workspaceOverrides?.[workspaceId]?.workflowRules ?? DEFAULT_WORKFLOW_RULES;
  await useAppStore.getState().attachWorkflowToSession(sessionId, workflowId, {
    navigate: true,
    goal: work,
    executionMode: 'dynamic',
    rulesSnapshot: {
      ...rules,
      autonomy: session.autoRun ? 'run' : 'step',
      route,
      ...(preset !== null && { preset: presetSnapshotOf({ preset }) }),
    },
  });
  if (preset === null) {
    void useAppStore
      .getState()
      .generateWorkflowTitle(workspaceId, workflowId, sessionId, name, ask, '');
  }
  return { kind: 'plan', workflowId };
};
