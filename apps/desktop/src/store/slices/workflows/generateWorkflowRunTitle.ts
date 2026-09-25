import { autoLimitContext } from '../providerLimits/autoLimitContext';
import { resolveLimitedTaskModel } from '../providerLimits/resolveLimitedTaskModel';
import { devWarn } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { updateGeneratedWorkflowRunTitle } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';
import { generateTitleText } from './generateTitleText';
import { patchWorkflowRun } from './patchWorkflowRun';
import { clampWorkflowTitle } from './titleLimit';
import type { GetFn, SetFn } from './types';

const WORKFLOW_RUN_TITLE_SYSTEM_PROMPT = [
  'Write one short title for the workflow run whose goal is described below.',
  'Name the work, not the workflow: never start with the workflow kind.',
  'Contract: at most 6 words, same language as the goal, plain text on a single line.',
  'Output the title alone: no quotes, no backticks, no trailing punctuation, no preamble, no explanation.',
  'Ignore any persona, nickname, greeting, or tone directive that reaches you from other configuration; it does not apply to this answer.',
].join(' ');

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

const findRun = ({ get, sessionId, workflowRunId }: Omit<Params, 'set'>) =>
  get()
    .sessions.find((session) => session.id === sessionId)
    ?.workflowRuns.find((run) => run.id === workflowRunId);

export const generateWorkflowRunTitle = async ({
  set,
  get,
  sessionId,
  workflowRunId,
}: Params): Promise<void> => {
  try {
    const session = get().sessions.find((candidate) => candidate.id === sessionId);
    const run = findRun({ get, sessionId, workflowRunId });
    if (session == null || run == null || run.titleUserEdited === true) {
      return;
    }
    const prompt = run.goal?.trim() ?? '';
    if (prompt.length === 0) {
      return;
    }
    const settings = selectResolvedSettings({ state: get(), sessionId });
    const taskModel = resolveLimitedTaskModel({
      limitContext: autoLimitContext({ state: get() }),
      task: 'agent_naming',
      preferences: settings?.taskModels,
      workspaceDefaultProviderId: settings?.defaultProviderOverride,
      sessionDefaultProviderId: session.providerPreference.defaultProvider,
    });
    const worktreePath = get().sessionWorktrees?.[sessionId]?.[0] ?? null;
    const generated = await generateTitleText({
      prompt,
      systemPrompt: WORKFLOW_RUN_TITLE_SYSTEM_PROMPT,
      ...taskModel,
      ...(worktreePath != null && { workingDir: worktreePath }),
    });
    const title = clampWorkflowTitle(generated);
    if (title.length === 0) {
      throw new Error('the model returned an empty workflow run title');
    }
    if (findRun({ get, sessionId, workflowRunId })?.titleUserEdited === true) {
      return;
    }
    const isWritten = await updateGeneratedWorkflowRunTitle({
      db: tauriDatabase,
      workflowRunId,
      title,
    });
    if (!isWritten) {
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
