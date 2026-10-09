import type { SearchHit, WorkspaceId } from '@goodboy/types';
import { agentPlace, branchPlace, sessionPlace, useAppStore } from '../../store';
import { openUrl } from '../../shared/lib/editor';
import { openPlanAnywhere } from '../plans/openPlanAnywhere';
import { selectWritableMounts } from '../../store/slices/project-mounts/selectors';
import { isNoteOnBranch, isUnassignedNote } from '../resolve/notes/noteThread';
import { useOpenQuestions } from '../context/components/QuestionsTab/useOpenQuestions';
import { searchHitTarget, type SearchHitTarget } from './searchHitTarget';

type WorkspaceParams = {
  readonly workspaceId: WorkspaceId | null;
};

const enterWorkspace = async ({ workspaceId }: WorkspaceParams): Promise<void> => {
  const store = useAppStore.getState();
  if (workspaceId === null || workspaceId === store.currentWorkspaceId) {
    return;
  }
  const workspace = store.workspaces.find((candidate) => candidate.id === workspaceId);
  await store.openWorkspace({
    id: workspaceId,
    title: workspace?.name ?? '',
    onRunning: 'new-window',
  });
};

type RunParams = {
  readonly target: SearchHitTarget;
};

const runTarget = async ({ target }: RunParams): Promise<boolean> => {
  if (target.kind === 'blocked') {
    return false;
  }
  if (target.kind === 'url') {
    await openUrl(target.url);
    return true;
  }
  if (target.kind === 'inbox') {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-inbox', {
        detail: {
          workspaceId: target.workspaceId,
          provider: target.provider,
          recordKey: target.recordKey,
        },
      }),
    );
    return true;
  }
  await enterWorkspace({ workspaceId: target.workspaceId });
  if (target.kind === 'workflow') {
    if (useAppStore.getState().currentWorkspaceId !== target.workspaceId) {
      return false;
    }
    useAppStore.getState().setWorkflowStudioFocus({ workflowId: target.workflowId });
    window.dispatchEvent(new CustomEvent('goodboy:open-workflow-studio'));
    return true;
  }
  const store = useAppStore.getState();
  if (!store.sessions.some((session) => session.id === target.sessionId)) {
    return false;
  }
  const { sessionId } = target;
  switch (target.kind) {
    case 'session':
      store.navigate({ to: sessionPlace({ sessionId }) });
      return true;
    case 'transcript':
      store.navigate({ to: agentPlace({ sessionId, agentId: target.agentId, pane: target.pane }) });
      return true;
    case 'artifact':
      if (target.isPlan) {
        openPlanAnywhere({ sessionId, planId: target.artifactId });
        return true;
      }
      store.navigate({
        to: sessionPlace({
          sessionId,
          lens: 'plans',
          target: { kind: 'artifact', artifactId: target.artifactId },
        }),
      });
      return true;
    case 'decision':
      store.navigate({
        to: sessionPlace({ sessionId }),
        drawer: {
          kind: 'context',
          sessionId,
          payload: { tab: 'decisions', view: 'current', highlight: [target.number] },
        },
      });
      return true;
    case 'question':
      useOpenQuestions.getState().focusQuestion(target.questionId);
      store.navigate({ to: sessionPlace({ sessionId, lens: 'questions' }) });
      return true;
    case 'linked-issue':
      store.openExternalTaskLens(sessionId, target.task);
      return true;
    case 'review':
      store.navigate({ to: branchPlace({ sessionId, tab: 'comments' }) });
      return true;
    case 'comment': {
      await store.loadDiffComments(sessionId);
      const state = useAppStore.getState();
      const note = (state.diffComments[sessionId] ?? []).find(
        (candidate) => candidate.id === target.commentId,
      );
      if (note === undefined) {
        return false;
      }
      if (isUnassignedNote({ note })) {
        state.navigate({ to: sessionPlace({ sessionId }) });
        return true;
      }
      const mount = selectWritableMounts({ state, sessionId }).find((candidate) =>
        isNoteOnBranch({ note, projectId: candidate.projectId, branch: candidate.branch }),
      );
      if (mount === undefined || mount.worktreePath === '') {
        return false;
      }
      state.navigate({
        to: branchPlace({ sessionId, mountPath: mount.worktreePath, tab: 'comments' }),
      });
      return true;
    }
    case 'diff': {
      const mount = (store.sessionMounts[sessionId] ?? []).find(
        (candidate) => candidate.id === target.mountId,
      );
      const path = mount?.worktreePath ?? null;
      if (path === null) {
        store.openDiffLens(sessionId, { kind: 'branch', path: null });
        return true;
      }
      store.openMountDiff(sessionId, path);
      return true;
    }
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
};

const FINDS_IN_VIEW: ReadonlySet<SearchHitTarget['kind']> = new Set(['transcript', 'artifact']);

type Params = {
  readonly hit: SearchHit;
  readonly query: string;
};

export const openSearchHit = async ({ hit, query }: Params): Promise<boolean> => {
  const target = searchHitTarget({ hit });
  const isOpened = await runTarget({ target });
  const store = useAppStore.getState();
  store.rememberSearchText({ text: query });
  if (!isOpened || !FINDS_IN_VIEW.has(target.kind) || query.trim().length === 0) {
    return isOpened;
  }
  const snippet = hit.snippet.map((segment) => segment.text).join('');
  store.startViewFind({ query, target: snippet.length > 0 ? snippet : null });
  return isOpened;
};
