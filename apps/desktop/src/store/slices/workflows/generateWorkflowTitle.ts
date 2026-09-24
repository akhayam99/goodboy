import { devWarn, resolveTaskModel } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { SessionId, WorkflowId, WorkspaceId } from '@goodboy/types';
import { invokeWorkflowUpsert } from '../../../features/workflows/workflows';
import { clampWorkflowTitle } from './titleLimit';
import { generateWorkflowTitleText } from './generateWorkflowTitleText';
import { isWorkflowTitleUserEdited } from './workflowTitleUserEdited';
import type { GetFn, SetFn } from './types';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';

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
      const taskModel = resolveTaskModel({
        task: 'agent_naming',
        preferences: selectResolvedSettings({ state: get(), sessionId })?.taskModels,
        workspaceDefaultProviderId: selectResolvedSettings({ state: get(), sessionId })
          ?.defaultProviderOverride,
        sessionDefaultProviderId: session.providerPreference.defaultProvider,
      });
      const worktreePath = get().sessionWorktrees?.[sessionId]?.[0] ?? null;

      const generated = await generateWorkflowTitleText({
        prompt,
        ...taskModel,
        ...(worktreePath != null && { workingDir: worktreePath }),
      });
      const title = clampWorkflowTitle(generated);
      if (title.length === 0) {
        throw new Error('the model returned an empty workflow title');
      }
      if (isWorkflowTitleUserEdited(workflowId)) {
        return;
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

      if (isWorkflowTitleUserEdited(workflowId)) {
        const renamed = (get().phaseTemplates[workspaceId] ?? []).find(
          (workflow) => workflow.id === workflowId,
        );
        if (renamed != null && renamed.name !== saved.name) {
          await invokeWorkflowUpsert({
            id: renamed.id,
            workspaceId: renamed.workspaceId,
            name: renamed.name,
            description: renamed.description,
            ...(renamed.goal != null && { goal: renamed.goal }),
            ...(renamed.processText != null && { processText: renamed.processText }),
            steps: renamed.steps,
            ...(renamed.isPreset != null && { isPreset: renamed.isPreset }),
            ...(renamed.origin != null && { origin: renamed.origin }),
          });
        }
        return;
      }
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
