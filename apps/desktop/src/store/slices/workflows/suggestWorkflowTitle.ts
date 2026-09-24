import { devWarn, resolveTaskModel } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { clampWorkflowTitle } from './titleLimit';
import { generateWorkflowTitleText } from './generateWorkflowTitleText';
import type { GetFn, SetFn } from './types';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';

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
      const taskModel = resolveTaskModel({
        task: 'agent_naming',
        preferences: settings?.taskModels,
        workspaceDefaultProviderId: settings?.defaultProviderOverride,
        sessionDefaultProviderId: session.providerPreference.defaultProvider,
      });
      const worktreePath = get().sessionWorktrees?.[sessionId]?.[0] ?? null;
      const generated = await generateWorkflowTitleText({
        prompt,
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
