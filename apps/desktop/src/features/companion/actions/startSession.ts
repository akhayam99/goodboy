import { DEFAULT_WORKFLOW_RULES, type ClaudePermissionMode, type SessionId } from '@goodboy/types';
import type { StartSessionAction } from '../contract/actions';
import type { SessionAccess } from '../contract/vocabulary';
import { workspaceIdOf } from './ids';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import type { HandlerResult, StartPorts, StoreHandlerParams } from './handlerTypes';
import { startLimitAmountsOf } from './startOptions';
import { phoneStartLimitOf } from './phoneStartLimitOf';
import { MAX_GOAL_LENGTH, recordStart, startsLeftToday } from './startState';

export const ACCESS_MODE = {
  readOnly: 'plan',
  askFirst: 'default',
  editsAllowed: 'acceptEdits',
} as const satisfies Record<SessionAccess, ClaudePermissionMode>;

type Params = StoreHandlerParams<StartSessionAction> & {
  readonly ports: StartPorts;
  readonly now: number;
};

type InvalidParams = {
  readonly message: string;
};

const invalid = ({ message }: InvalidParams): HandlerResult =>
  refusedResult({ code: 'invalid-request', message });

export const startSession = async ({
  action,
  getStore,
  ports,
  now,
}: Params): Promise<HandlerResult> => {
  const store = getStore();
  const workspaceId = workspaceIdOf({ value: action.workspaceId });
  if (!store.workspaces.some((workspace) => workspace.id === action.workspaceId)) {
    return refusedResult({ code: 'unknown-target', message: 'This workspace is not on your Mac.' });
  }
  const project = store.projects.find(
    (candidate) =>
      candidate.id === action.projectId && candidate.workspaceId === action.workspaceId,
  );
  if (project === undefined) {
    return refusedResult({ code: 'unknown-target', message: 'This project is not on your Mac.' });
  }
  const typed = action.goal.trim();
  if (typed.length > MAX_GOAL_LENGTH) {
    return invalid({ message: `The goal is longer than ${MAX_GOAL_LENGTH} characters.` });
  }
  if (typed.length === 0 && action.task === null) {
    return invalid({ message: 'Write a goal or pick a task.' });
  }
  const preset =
    action.startKind === 'leadPlan'
      ? ((store.phaseTemplates[workspaceId] ?? []).find(
          (workflow) => workflow.isPreset === true && workflow.id === action.presetId,
        ) ?? null)
      : null;
  if (action.startKind === 'leadPlan' && preset === null) {
    return invalid({ message: 'This plan is not on your Mac.' });
  }
  const rules = store.workspaceOverrides[workspaceId]?.workflowRules ?? DEFAULT_WORKFLOW_RULES;
  const defaultUsd = rules.spendLimitUsd;
  if (action.startKind === 'agentScout' && action.limitUsd !== null) {
    return invalid({ message: 'A single agent has no limit to set.' });
  }
  if (action.limitUsd !== null && !startLimitAmountsOf({ defaultUsd }).includes(action.limitUsd)) {
    return invalid({ message: 'This limit is not one your Mac offers.' });
  }
  if (startsLeftToday({ now }) === 0) {
    return refusedResult({
      code: 'rate-limited',
      message: 'Your Mac has started enough sessions from phones today.',
    });
  }
  let resolved: Awaited<ReturnType<StartPorts['resolveTask']>> | null = null;
  try {
    resolved =
      action.task === null
        ? null
        : await ports.resolveTask({
            workspaceId,
            provider: action.task.provider,
            key: action.task.key,
          });
  } catch (error) {
    console.error('[bridge] startSession task lookup failed', error);
    return failedResult({ error: 'Could not read this task. Try again.' });
  }
  const goal = typed.length > 0 ? typed : (resolved?.goal ?? '');
  let sessionId: SessionId | null = null;
  try {
    const { session } = await store.createSession({
      workspaceId,
      projectId: project.id,
      shouldPickFolders: true,
      goal,
      ...(resolved === null ? {} : { externalTasks: [resolved.externalTask] }),
    });
    sessionId = session.id;
    await ports.launch({
      sessionId: session.id,
      mode: ACCESS_MODE[action.access],
      startKind: action.startKind,
      preset,
      ask: goal,
      limit:
        action.startKind === 'agentScout'
          ? null
          : phoneStartLimitOf({ limitUsd: action.limitUsd, defaultUsd }),
    });
  } catch (error) {
    console.error('[bridge] startSession failed', error);
    if (sessionId !== null) {
      await ports.discard({ sessionId }).catch(() => undefined);
    }
    return failedResult({ error: 'The session did not start. Nothing was kept. Try again.' });
  }
  recordStart({ workspaceId, now });
  return doneResult({ createdSessionId: sessionId });
};
