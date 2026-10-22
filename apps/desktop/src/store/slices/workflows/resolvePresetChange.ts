import type { PlanChangeRequest, SessionId, WorkflowRules, WorkflowRunId } from '@goodboy/types';
import { RUN_ROUTE_COPY } from '../../../features/session/startRun/runRouteCopy';
import { findWorkflowRun } from './findWorkflowRun';
import { rulesWithoutAsk } from './rulesWithoutAsk';
import { planChangeVerdictOf } from './planChangeVerdictOf';
import { PRESET_CHANGE_COPY } from './presetChangeCopy';
import type { GetFn, SetFn } from './types';

export type PresetChangeAnswer = 'apply' | 'decline' | 'adapt';

type SameParams = {
  readonly rules: WorkflowRules;
  readonly pending: PlanChangeRequest;
};

const isStillPending = ({ rules, pending }: SameParams): boolean =>
  rules.pendingChange !== undefined &&
  rules.pendingChange.kind === pending.kind &&
  rules.pendingChange.step === pending.step &&
  rules.pendingChange.reason === pending.reason;

type AnsweredParams = {
  readonly rules: WorkflowRules;
  readonly pending: PlanChangeRequest;
  readonly answer: PresetChangeAnswer;
};

const answeredRules = ({ rules, pending, answer }: AnsweredParams): WorkflowRules => {
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
};

export const resolvePresetChange = (_set: SetFn, get: GetFn) => {
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
    const text =
      answer === 'decline'
        ? PRESET_CHANGE_COPY.declinedHint({ change: pending })
        : PRESET_CHANGE_COPY.approvedHint({ change: pending });
    const isHintQueued = (run.orchestratorHints ?? []).some(
      (hint) => hint.consumedAt == null && hint.text === text,
    );
    if (!isHintQueued) {
      await get().addWorkflowOrchestratorHint(sessionId, workflowRunId, {
        text,
        delivery: 'queue',
      });
    }
    const answered = await get().updateWorkflowRunRules(
      sessionId,
      workflowRunId,
      (rules) =>
        isStillPending({ rules, pending }) ? answeredRules({ rules, pending, answer }) : null,
      { shouldClearStop: true },
    );
    if (answered === null) {
      return false;
    }
    await get().orchestrateNextStep(sessionId, workflowRunId, { bypassGate: true });
    return true;
  };
};
