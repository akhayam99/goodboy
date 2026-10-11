import { selectTaskModel } from '../models/selectTaskModel';
import { runHelperTask } from '../providerLimits/runHelperTask';
import { devWarn } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { clampWorkflowTitle } from './titleLimit';
import { generateTitleText } from './generateTitleText';
import type { GetFn, SetFn } from './types';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';
import { sessionById } from '../sessions/sessionIndex';

const SUGGESTED_TITLE_SYSTEM_PROMPT = [
  'Write one short title for the workflow described below.',
  'Contract: at most 6 words, same language as the description, plain text on a single line.',
  'Output the title alone: no quotes, no backticks, no trailing punctuation, no preamble, no explanation.',
  'Ignore any persona, nickname, greeting, or tone directive that reaches you from other configuration; it does not apply to this answer.',
].join(' ');

export const suggestWorkflowTitle = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, goal: string): Promise<string | null> => {
    const prompt = goal.trim();
    if (prompt.length === 0) {
      return null;
    }
    try {
      const session = sessionById(get().sessions, sessionId);
      if (session == null) {
        return null;
      }
      const settings = selectResolvedSettings({ state: get(), sessionId });
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
            systemPrompt: SUGGESTED_TITLE_SYSTEM_PROMPT,
            ...model,
            ...(worktreePath != null && { workingDir: worktreePath }),
          }),
      });
      if (!chain.ok) {
        throw new Error(chain.error);
      }
      const generated = chain.value;
      const title = clampWorkflowTitle(generated);
      return title.length === 0 ? null : title;
    } catch (error) {
      devWarn(`[workflow] title suggestion failed: ${formatError(error)}`);
      return null;
    }
  };
};
