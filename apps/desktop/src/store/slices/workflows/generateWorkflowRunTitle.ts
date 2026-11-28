import { selectTaskModel } from '../../runtime/models/selectTaskModel';
import { runHelperTask } from '../providerLimits/runHelperTask';
import { devWarn } from '@goodboy/core/dev-log';
import { formatError } from '@goodboy/ui';
import type { PreferredLanguage } from '@goodboy/core/language';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { updateGeneratedWorkflowRunTitle } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { generateTitleText } from './generateTitleText';
import { titleReplyRulesOf } from '../turn/applyHeuristicTitle/titleReplyRules';
import { loadPreferredLanguage } from '../settings/loadPreferredLanguage';
import { patchWorkflowRun } from './patchWorkflowRun';
import type { GetFn, SetFn } from './types';
import { sessionById } from '../sessions/sessionIndex';

type SystemPromptParams = {
  readonly preferred: PreferredLanguage | null;
};

const workflowRunTitleSystemPromptOf = ({ preferred }: SystemPromptParams): string =>
  [
    'Write one short title for the workflow run whose goal is described below.',
    'Name the work, not the workflow: never start with the workflow kind.',
    titleReplyRulesOf({ preferred }),
  ].join(' ');

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

const findRun = ({ get, sessionId, workflowRunId }: Omit<Params, 'set'>) =>
  sessionById(get().sessions, sessionId)?.workflowRuns.find((run) => run.id === workflowRunId);

export const generateWorkflowRunTitle = async ({
  set,
  get,
  sessionId,
  workflowRunId,
}: Params): Promise<void> => {
  try {
    const session = sessionById(get().sessions, sessionId);
    const run = findRun({ get, sessionId, workflowRunId });
    if (session == null || run == null || run.titleUserEdited === true) {
      return;
    }
    const prompt = run.goal?.trim() ?? '';
    if (prompt.length === 0) {
      return;
    }
    const preferred = await loadPreferredLanguage({ get, workspaceId: session.workspaceId });
    const taskModel = selectTaskModel({ state: get(), sessionId, task: 'agent_naming' });
    const worktreePath = get().sessionWorktrees?.[sessionId]?.[0] ?? null;
    const chain = await runHelperTask({
      set,
      get,
      sessionId,
      first: taskModel,
      run: (model) =>
        generateTitleText({
          prompt,
          systemPrompt: workflowRunTitleSystemPromptOf({ preferred }),
          preferred,
          ...model,
          ...(worktreePath != null && { workingDir: worktreePath }),
        }),
    });
    if (!chain.ok) {
      throw new Error(chain.error);
    }
    if (findRun({ get, sessionId, workflowRunId })?.titleUserEdited === true) {
      return;
    }
    const title = await updateGeneratedWorkflowRunTitle({
      db: tauriDatabase,
      workflowRunId,
      title: chain.value,
    });
    if (title === null) {
      return;
    }
    patchWorkflowRun({
      set,
      sessionId,
      workflowRunId,
      patch: (current) => (current.titleUserEdited === true ? current : { ...current, title }),
    });
  } catch (error) {
    devWarn(`[workflow] run title generation failed: ${formatError(error)}`);
  }
};
