import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { RUN_ROUTE_COPY } from '../../../features/session/startRun/runRouteCopy';
import { findWorkflowRun } from './findWorkflowRun';
import { persistOrchestrationStop } from './orchestrateNextStep';
import { rulesWithoutAsk } from './rulesWithoutAsk';
import { planChangeVerdictOf } from './planChangeVerdictOf';
import { PRESET_CHANGE_COPY } from './presetChangeCopy';
import type { GetFn, SetFn } from './types';

export type PresetChangeAnswer = 'apply' | 'decline' | 'adapt';

export const resolvePresetChange = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    workflowRunId: WorkflowRunId,
    answer: PresetChangeAnswer,
  ): Promise<boolean> => {
    const run = findWorkflowRun({ get, sessionId, workflowRunId });
    const pending = run?.rulesSnapshot?.pendingChange;
    if (run == null || run.orchestrationStop?.kind !== 'preset-change' || pending === undefined) {
      return false;
    }
    const verdict = planChangeVerdictOf({ rules: run.rulesSnapshot, change: pending });
    if (verdict === 'pinned' && answer !== 'decline') {
      return false;
    }
    await get().addWorkflowOrchestratorHint(sessionId, workflowRunId, {
      text:
        answer === 'decline'
          ? PRESET_CHANGE_COPY.declinedHint({ change: pending })
          : PRESET_CHANGE_COPY.approvedHint({ change: pending }),
      delivery: 'queue',
    });
    await get().updateWorkflowRunRules(sessionId, workflowRunId, (rules) => {
      const rest = rulesWithoutAsk({ rules });
      const route =
        answer === 'adapt' && rest.route !== undefined
          ? {
              route: {
                ...rest.route,
                closeness: 'adapt' as const,
                choice: rest.route.choice.replace(
                  RUN_ROUTE_COPY.closeness.follow,
                  RUN_ROUTE_COPY.closeness.adapt,
                ),
              },
            }
          : {};
      return { ...rest, ...route, ...(answer === 'decline' ? {} : { approvedChange: pending }) };
    });
    await persistOrchestrationStop({ set, sessionId, workflowRunId, stop: null });
    await get().orchestrateNextStep(sessionId, workflowRunId, { bypassGate: true });
    return true;
  };
};
