import type { PlanId, SessionExternalTask, SessionId } from '@goodboy/types';
import type {
  DiffFocus,
  GetFn,
  LensKind,
  SessionStudio,
  SetFn,
  WorkSurfacePosition,
} from './types';
import { PROVIDER_LENS } from '../../../features/integrations/providerLens';
import { amendTopPosition } from './amendTopPosition';
import { workSurfaceFocus } from './workSurfaceFocus';
import { writePersistedLens } from './workSurfaceStorage';

export const setActiveLens = (set: SetFn) => {
  return (sessionId: SessionId, lens: LensKind | null): void => {
    writePersistedLens(sessionId, lens);
    set((s) => {
      const prev = s.lensHistory[sessionId];
      const trimmed = prev ? prev.entries.slice(0, prev.index + 1) : [];
      const current: WorkSurfacePosition = {
        lens: s.activeLens[sessionId] ?? null,
        agentId: s.selectedAgentId[sessionId] ?? null,
        studio: s.sessionStudio[sessionId] ?? null,
      };
      const amended = amendTopPosition({ entries: trimmed, current });
      const top = amended[amended.length - 1];
      const sameTop =
        top != null && top.lens === lens && top.agentId === null && top.studio === null;
      const entries = sameTop ? amended : [...amended, { lens, agentId: null, studio: null }];
      return {
        ...workSurfaceFocus({
          sessionId,
          focus: { kind: 'lens', lens },
          activeLens: s.activeLens,
          sessionStudio: s.sessionStudio,
          selectedAgentId: s.selectedAgentId,
        }),
        focusedWorkflowRunId:
          lens === 'workflows'
            ? s.focusedWorkflowRunId
            : { ...s.focusedWorkflowRunId, [sessionId]: null },
        diffFocus: lens === 'files' ? s.diffFocus : { ...s.diffFocus, [sessionId]: null },
        diffMountPath:
          lens === 'files' ? s.diffMountPath : { ...s.diffMountPath, [sessionId]: null },
        focusedPlanId:
          lens === 'plans' ? s.focusedPlanId : { ...s.focusedPlanId, [sessionId]: null },
        focusedGithubIssueNumber:
          lens === 'github_issue'
            ? s.focusedGithubIssueNumber
            : { ...s.focusedGithubIssueNumber, [sessionId]: null },
        focusedExternalTask: { ...s.focusedExternalTask, [sessionId]: null },
        lensHistory: {
          ...s.lensHistory,
          [sessionId]: { entries, index: entries.length - 1 },
        },
      };
    });
  };
};

export const lensGo = (set: SetFn, get: GetFn) => {
  return (sessionId: SessionId, delta: number): void => {
    const hist = get().lensHistory[sessionId];
    if (!hist) return;
    const nextIndex = Math.min(Math.max(hist.index + delta, 0), hist.entries.length - 1);
    if (nextIndex === hist.index) return;
    const entry = hist.entries[nextIndex];
    if (entry == null) return;
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const agentId =
      entry.agentId != null && runs.some((run) => run.id === entry.agentId) ? entry.agentId : null;
    const restored: WorkSurfacePosition = { lens: entry.lens, agentId, studio: entry.studio };
    writePersistedLens(sessionId, restored.lens);
    set((s) => ({
      ...workSurfaceFocus({
        sessionId,
        focus: {
          kind: 'restore',
          lens: restored.lens,
          studio: restored.studio,
          agentId: restored.agentId,
        },
        activeLens: s.activeLens,
        sessionStudio: s.sessionStudio,
        selectedAgentId: s.selectedAgentId,
      }),
      lensHistory: {
        ...s.lensHistory,
        [sessionId]: {
          entries: hist.entries.map((item, index) => (index === nextIndex ? restored : item)),
          index: nextIndex,
        },
      },
    }));
  };
};

export const toggleWorkflowExpand = (set: SetFn) => {
  return (sessionId: SessionId, runId: string, defaultExpanded: boolean): void => {
    set((s) => {
      const current = s.workflowExpand[sessionId] ?? {};
      const next = !(current[runId] ?? defaultExpanded);
      return {
        workflowExpand: {
          ...s.workflowExpand,
          [sessionId]: { ...current, [runId]: next },
        },
        focusedWorkflowRunId: { ...s.focusedWorkflowRunId, [sessionId]: null },
      };
    });
  };
};

export const setFocusedWorkflowRun = (set: SetFn) => {
  return (sessionId: SessionId, runId: string | null): void => {
    set((s) => ({
      focusedWorkflowRunId: { ...s.focusedWorkflowRunId, [sessionId]: runId },
    }));
  };
};

export const setDiffFocus = (set: SetFn) => {
  return (sessionId: SessionId, focus: DiffFocus | null): void => {
    set((s) => ({ diffFocus: { ...s.diffFocus, [sessionId]: focus } }));
  };
};

export const openDiffLens = (get: GetFn) => {
  return (sessionId: SessionId, focus: DiffFocus | null): void => {
    get().setDiffFocus(sessionId, focus);
    get().setActiveLens(sessionId, 'files');
  };
};

export const openMountDiff = (set: SetFn, get: GetFn) => {
  return (sessionId: SessionId, worktreePath: string): void => {
    set((s) => ({ diffMountPath: { ...s.diffMountPath, [sessionId]: worktreePath } }));
    get().setDiffFocus(sessionId, null);
    get().setActiveLens(sessionId, 'files');
  };
};

export const setFocusedPlanId = (set: SetFn) => {
  return (sessionId: SessionId, planId: PlanId | null): void => {
    set((s) => ({ focusedPlanId: { ...s.focusedPlanId, [sessionId]: planId } }));
  };
};

export const setFocusedGithubIssueNumber = (set: SetFn) => {
  return (sessionId: SessionId, issueNumber: number | null): void => {
    set((s) => ({
      focusedGithubIssueNumber: { ...s.focusedGithubIssueNumber, [sessionId]: issueNumber },
    }));
  };
};

export const openExternalTaskLens = (set: SetFn, get: GetFn) => {
  return (sessionId: SessionId, task: SessionExternalTask): void => {
    get().setActiveLens(sessionId, PROVIDER_LENS[task.provider]);
    if (task.provider === 'github') {
      get().setFocusedGithubIssueNumber(sessionId, Number(task.externalId));
      return;
    }
    set((s) => ({
      focusedExternalTask: {
        ...s.focusedExternalTask,
        [sessionId]: {
          provider: task.provider,
          externalId: task.externalId,
          projectId: task.projectId ?? null,
        },
      },
    }));
  };
};

export const setSessionStudio = (set: SetFn) => {
  return (sessionId: SessionId, studio: SessionStudio | null): void => {
    set((s) =>
      workSurfaceFocus({
        sessionId,
        focus: { kind: 'studio', studio },
        activeLens: s.activeLens,
        sessionStudio: s.sessionStudio,
        selectedAgentId: s.selectedAgentId,
      }),
    );
  };
};
