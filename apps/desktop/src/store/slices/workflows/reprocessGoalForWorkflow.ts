import type { ContextSlot, SessionId } from '@goodboy/types';
import { rewriteWorkflowGoal } from '@goodboy/core';
import { insertContextSlotHistory, upsertContextSlot } from '@goodboy/db';
import { invoke } from '@tauri-apps/api/core';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export function reprocessGoalForWorkflow(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId): Promise<void> => {
    try {
      const state = get();
      const session = state.sessions.find((s) => s.id === sessionId);
      if (!session) return;

      const slots = state.sessionSlots[sessionId] ?? [];
      const goalSlot = slots.find((s) => s.key === 'goal');
      const goal = goalSlot?.value.trim() ?? '';
      if (goal.length === 0) return;

      const templates = state.phaseTemplates[session.workspaceId] ?? [];
      const discarded = new Set(session.discardedWorkflowIds ?? []);
      const stepNames = session.workflowIds
        .filter((id) => !discarded.has(id))
        .flatMap((id) => {
          const template = templates.find((t) => t.id === id);
          if (!template) return [];
          return [...template.steps].sort((a, b) => a.ordinal - b.ordinal).map((s) => s.name);
        });
      if (stepNames.length === 0) return;

      const rewritten = await rewriteWorkflowGoal(
        { providerId: session.providerPreference.defaultProvider, invokeFn: invoke },
        { goal, stepNames },
      );
      const cleaned = rewritten?.trim() ?? '';
      if (cleaned.length === 0 || cleaned === goal) return;

      await insertContextSlotHistory(
        tauriDatabase,
        sessionId,
        crypto.randomUUID(),
        'goal',
        goal,
        'summarizer',
      );
      const next: ContextSlot = { key: 'goal', value: cleaned, enabled: goalSlot?.enabled ?? true };
      await upsertContextSlot(tauriDatabase, sessionId, next);

      set((s) => {
        const existing = s.sessionSlots[sessionId] ?? [];
        const hasGoal = existing.some((x) => x.key === 'goal');
        return {
          sessionSlots: {
            ...s.sessionSlots,
            [sessionId]: hasGoal
              ? existing.map((x) => (x.key === 'goal' ? next : x))
              : [...existing, next],
          },
        };
      });
    } catch (e) {
      console.error('reprocessGoalForWorkflow failed', e);
    }
  };
}
