import type { ArtifactId, SessionExternalTask, SessionId } from '@goodboy/types';
import type { DiffFocus, GetFn, LensKind, SessionStudio, SetFn } from './types';
import { sentryRecordKey } from '../../../features/inbox/adapters/sentry';
import { PROVIDER_LENS } from '../../../features/integrations/providerLens';
import { workSurfaceFocus } from './workSurfaceFocus';
import { drawerAfterMove } from '../drawer/drawerAfterMove';
import { drawerAfterArtifactFocus } from '../drawer/drawerAfterArtifactFocus';
import { sessionPlace } from '../navigation/place';

export const setActiveLens = (set: SetFn) => {
  return (sessionId: SessionId, lens: LensKind | null): void => {
    set((s) => ({
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
      diffMountPath: lens === 'files' ? s.diffMountPath : { ...s.diffMountPath, [sessionId]: null },
      terminalMountPath:
        lens === 'terminal' ? s.terminalMountPath : { ...s.terminalMountPath, [sessionId]: null },
      focusedArtifactId:
        lens === 'plans' ? s.focusedArtifactId : { ...s.focusedArtifactId, [sessionId]: null },
      focusedGithubIssueNumber:
        lens === 'github_issue'
          ? s.focusedGithubIssueNumber
          : { ...s.focusedGithubIssueNumber, [sessionId]: null },
      focusedExternalTask: { ...s.focusedExternalTask, [sessionId]: null },
      drawer: drawerAfterMove({ drawer: s.drawer, sessionId, lens }),
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
    get().navigate({
      to: sessionPlace({
        sessionId,
        lens: 'files',
        target: {
          kind: 'diff',
          mountPath: get().diffMountPath[sessionId] ?? null,
          focus,
        },
      }),
    });
  };
};

export const openMountDiff = (get: GetFn) => {
  return (sessionId: SessionId, worktreePath: string): void => {
    get().navigate({
      to: sessionPlace({
        sessionId,
        lens: 'files',
        target: { kind: 'diff', mountPath: worktreePath, focus: null },
      }),
    });
  };
};

export const openMountTerminal = (get: GetFn) => {
  return (sessionId: SessionId, worktreePath: string): void => {
    get().navigate({
      to: sessionPlace({
        sessionId,
        lens: 'terminal',
        target: { kind: 'terminal', mountPath: worktreePath },
      }),
    });
  };
};

export const setFocusedArtifactId = (set: SetFn) => {
  return (sessionId: SessionId, artifactId: ArtifactId | null): void => {
    set((s) => ({
      focusedArtifactId: { ...s.focusedArtifactId, [sessionId]: artifactId },
      drawer: drawerAfterArtifactFocus({ drawer: s.drawer, artifactId }),
    }));
  };
};

export const setFocusedGithubIssueNumber = (set: SetFn) => {
  return (sessionId: SessionId, issueNumber: number | null): void => {
    set((s) => ({
      focusedGithubIssueNumber: { ...s.focusedGithubIssueNumber, [sessionId]: issueNumber },
    }));
  };
};

export const openExternalTaskLens = (get: GetFn) => {
  return (sessionId: SessionId, task: SessionExternalTask): void => {
    if (task.provider === 'sentry') {
      const workspaceId = get().sessions.find((session) => session.id === sessionId)?.workspaceId;
      window.dispatchEvent(
        new CustomEvent('goodboy:open-inbox', {
          detail: {
            workspaceId,
            provider: 'sentry',
            recordKey: sentryRecordKey({ issueId: task.externalId }),
            sessionId,
          },
        }),
      );
      return;
    }
    const lens = PROVIDER_LENS[task.provider];
    if (task.provider === 'github') {
      get().navigate({
        to: sessionPlace({
          sessionId,
          lens,
          target: { kind: 'github-issue', issueNumber: Number(task.externalId) },
        }),
      });
      return;
    }
    get().navigate({
      to: sessionPlace({
        sessionId,
        lens,
        target: {
          kind: 'external-task',
          task: {
            provider: task.provider,
            externalId: task.externalId,
            projectId: task.projectId ?? null,
          },
        },
      }),
    });
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
