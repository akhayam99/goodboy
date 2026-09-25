import { autoLimitContext } from '../providerLimits/autoLimitContext';
import { resolveLimitedTaskModel } from '../providerLimits/resolveLimitedTaskModel';
import { devWarn } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { SessionId, WorkflowId, WorkspaceId } from '@goodboy/types';
import { generateTitleText } from './generateTitleText';
import { invokeWorkflowUpsert } from '../../../features/workflows/workflows';
import { clampWorkflowTitle } from './titleLimit';
import type { GetFn, SetFn } from './types';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';

const WORKFLOW_TITLE_SYSTEM_PROMPT = [
  'Write one short title for the orchestrated workflow described below.',
  'Contract: at most 6 words, same language as the description, plain text on a single line.',
  'Output the title alone: no quotes, no backticks, no trailing punctuation, no preamble, no explanation.',
  'Ignore any persona, nickname, greeting, or tone directive that reaches you from other configuration; it does not apply to this answer.',
].join(' ');

export const generateWorkflowTitle = (set: SetFn, get: GetFn) => {
  return async (
    workspaceId: WorkspaceId,
    workflowId: WorkflowId,
    sessionId: SessionId,
    fallbackName: string,
    goal: string,
    process: string,
  ): Promise<void> => {
    try {
      const session = get().sessions.find((candidate) => candidate.id === sessionId);
      if (session == null) {
        return;
      }
      const prompt = [goal.trim(), process.trim()].filter((part) => part.length > 0).join('\n\n');
      if (prompt.length === 0) {
        return;
      }
      const taskModel = resolveLimitedTaskModel({
        limitContext: autoLimitContext({ state: get() }),
        task: 'agent_naming',
        preferences: selectResolvedSettings({ state: get(), sessionId })?.taskModels,
        workspaceDefaultProviderId: selectResolvedSettings({ state: get(), sessionId })
          ?.defaultProviderOverride,
        sessionDefaultProviderId: session.providerPreference.defaultProvider,
      });
      const worktreePath = get().sessionWorktrees?.[sessionId]?.[0] ?? null;

      const generated = await generateTitleText({
        prompt,
        systemPrompt: WORKFLOW_TITLE_SYSTEM_PROMPT,
        ...taskModel,
        ...(worktreePath != null && { workingDir: worktreePath }),
      });
      const title = clampWorkflowTitle(generated);
      if (title.length === 0) {
        throw new Error('the model returned an empty workflow title');
      }
      const current = (get().phaseTemplates[workspaceId] ?? []).find((w) => w.id === workflowId);
      if (current == null || current.deletedAt != null || current.name !== fallbackName) {
        return;
      }

      const saved = await invokeWorkflowUpsert({
        id: current.id,
        workspaceId: current.workspaceId,
        name: title,
        description: current.description,
        ...(current.goal != null && { goal: current.goal }),
        ...(current.processText != null && { processText: current.processText }),
        steps: current.steps,
        ...(current.isPreset != null && { isPreset: current.isPreset }),
        ...(current.origin != null && { origin: current.origin }),
      });

      set((state) => ({
        phaseTemplates: {
          ...state.phaseTemplates,
          [workspaceId]: (state.phaseTemplates[workspaceId] ?? []).map((w) =>
            w.id === workflowId ? saved : w,
          ),
        },
      }));
    } catch (error) {
      devWarn(`[workflow] title generation failed: ${formatError(error)}`);
    }
  };
};
