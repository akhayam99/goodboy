import { autoLimitContext } from '../providerLimits/autoLimitContext';
import { resolveLimitedTaskModel } from '../providerLimits/resolveLimitedTaskModel';
import { devWarn } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { clampWorkflowTitle } from './titleLimit';
import { generateTitleText } from './generateTitleText';
import type { GetFn, SetFn } from './types';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';

const SUGGESTED_TITLE_SYSTEM_PROMPT = [
  'Write one short title for the workflow described below.',
  'Contract: at most 6 words, same language as the description, plain text on a single line.',
  'Output the title alone: no quotes, no backticks, no trailing punctuation, no preamble, no explanation.',
  'Ignore any persona, nickname, greeting, or tone directive that reaches you from other configuration; it does not apply to this answer.',
].join(' ');

export const suggestWorkflowTitle = (_set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, goal: string): Promise<string | null> => {
    const prompt = goal.trim();
    if (prompt.length === 0) {
      return null;
    }
    try {
      const session = get().sessions.find((candidate) => candidate.id === sessionId);
      if (session == null) {
        return null;
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
        systemPrompt: SUGGESTED_TITLE_SYSTEM_PROMPT,
        ...taskModel,
        ...(worktreePath != null && { workingDir: worktreePath }),
      });
      const title = clampWorkflowTitle(generated);
      return title.length === 0 ? null : title;
    } catch (error) {
      devWarn(`[workflow] title suggestion failed: ${formatError(error)}`);
      return null;
    }
  };
};
