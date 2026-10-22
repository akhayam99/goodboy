import {
  DEFAULT_WORKFLOW_RULES,
  brandId,
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
import type { RunRouteResult } from './runRouteOf';
import { runRoutesKey, writeRunRoute } from './runRoutesSetting';

type Params = {
  readonly sessionId: SessionId;
  readonly result: RunRouteResult;
};

type PresetTextParams = {
  readonly preset: Workflow;
};

const presetProcessOf = ({ preset }: PresetTextParams): string =>
  [
    `Start from the preset ${preset.name}. Its steps, in order:`,
    ...preset.steps
      .filter((step) => step.deletedAt == null)
      .map((step, index) => `${index + 1}. ${step.role ?? 'agent'}: ${step.name}`),
  ].join('\n');

export const startRoutedRun = async ({ sessionId, result }: Params): Promise<void> => {
  const state = useAppStore.getState();
  const session = sessionById(state.sessions, sessionId);
  if (session === undefined || session === null) {
    throw new Error('This session is no longer here');
  }
  const { route, ask, preset, role } = result;
  if (route.shape === 'lead') {
    const agentId = await state.spawnAgent(sessionId, {
      kindOverride: role ?? 'auto',
      initialPrompt: ask,
      focus: 'agent',
    });
    await writeRunRoute({ db: tauriDatabase, sessionId, agentId, route });
    await useAppStore.getState().loadSetting(runRoutesKey({ sessionId }));
    window.dispatchEvent(openAgentRevealEvent());
    return;
  }
  const workspaceId = session.workspaceId;
  const existing = state.phaseTemplates[workspaceId] ?? [];
  const now = brandId<IsoDateTime>({ value: new Date().toISOString() });
  const workflowId = brandId<WorkflowId>({ value: `wf_run_${crypto.randomUUID()}` });
  const name = uniqueWorkflowName({
    requested: preset === null ? ORCHESTRATED_WORKFLOW_NAME : `Plan from ${preset.name}`,
    existing,
  });
  const process = preset === null ? '' : presetProcessOf({ preset });
  const workflow: Workflow = {
    id: workflowId,
    workspaceId,
    name,
    description: 'Steps are decided at runtime from the latest results.',
    goal: ask,
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
    goal: ask,
    executionMode: 'dynamic',
    rulesSnapshot: { ...rules, autonomy: session.autoRun ? 'run' : 'step', route },
  });
  if (preset === null) {
    void useAppStore
      .getState()
      .generateWorkflowTitle(workspaceId, workflowId, sessionId, name, ask, '');
  }
};
