import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  FolderOpen,
  GitBranch,
  GitPullRequest,
  LoaderCircle,
  Upload,
} from 'lucide-react';
import { Eyebrow } from '@goodboy/ui';
import type { Agent, Session, SessionId, WorktreeStatus } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useRebaseAgent } from '../../hooks/useRebaseAgent';
import { usePushBranch } from '../../hooks/usePushBranch';
import { worktreeStatus } from '../../../worktree/worktree';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { isPrReviewSession } from '../../../../store/slices/session-view';
import { openInEditor } from '../../../../shared/lib/editor';
import { formatError } from '../../../../shared/lib/errors';
import { useToast } from '../../../../app/components/Toast';
import {
  DEFAULT_EDITOR_BINARY,
  SETTING_DEFAULT_EDITOR,
  SETTING_EDITOR_BINARY,
} from '../../../settings/settings';

type Props = {
  readonly session: Session;
};

const STATUS_REFRESH_INTERVAL_MS = 10_000;

const ACTION_CLASS =
  'group inline-flex min-h-9 items-center gap-2 rounded-lg border border-border-soft bg-elevated px-3 py-2 text-left text-sm font-medium text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50';

export const SessionShortcuts = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const worktreePath = useAppStore((state) => state.sessionWorktrees[sessionId]?.[0] ?? null);
  const branch = useAppStore((state) => state.sessionBranches[sessionId] ?? null);
  const pullRequest = useAppStore((state) => state.sessionGithub[sessionId]?.pr ?? null);
  const workspaceKind = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === session.workspaceId)?.kind ?? 'repo',
  );
  const phaseRuns = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const settings = useAppStore((state) => state.settings);
  const detectedEditors = useAppStore((state) => state.detectedEditors);
  const loadDetectedEditors = useAppStore((state) => state.loadDetectedEditors);
  const { showToast } = useToast();
  const [status, setStatus] = useState<WorktreeStatus | null>(null);
  const lastRefreshAt = useRef(0);
  const statusPath = useRef<string | null>(null);
  const rebase = useRebaseAgent({ sessionId, status });
  const push = usePushBranch({ sessionId });

  useEffect(() => {
    if (worktreePath == null) {
      statusPath.current = null;
      setStatus(null);
      return;
    }
    let isDisposed = false;
    if (statusPath.current !== worktreePath) {
      statusPath.current = worktreePath;
      lastRefreshAt.current = Date.now() - STATUS_REFRESH_INTERVAL_MS;
      setStatus(null);
    }
    const refreshStatus = () => {
      const now = Date.now();
      if (now - lastRefreshAt.current < STATUS_REFRESH_INTERVAL_MS) {
        return;
      }
      lastRefreshAt.current = now;
      void worktreeStatus(worktreePath)
        .then((nextStatus) => {
          if (!isDisposed) {
            setStatus(nextStatus);
          }
        })
        .catch(() => undefined);
    };
    refreshStatus();
    window.addEventListener('focus', refreshStatus);
    return () => {
      isDisposed = true;
      window.removeEventListener('focus', refreshStatus);
    };
  }, [worktreePath]);

  useEffect(() => {
    if (worktreePath == null || detectedEditors.length > 0) {
      return;
    }
    void loadDetectedEditors();
  }, [detectedEditors.length, loadDetectedEditors, worktreePath]);

  const isBranchless = isBranchlessSession({ workspaceKind, branch });
  const isPrReview = isPrReviewSession({ agents: phaseRuns });
  const canPush = status != null && status.ahead > 0;
  const canOpenPr = pullRequest == null && !isBranchless && !isPrReview;
  const canOpenEditor = worktreePath != null;
  const hasActions = rebase.canRebase || canPush || canOpenPr || canOpenEditor;
  const configuredEditor =
    settings[SETTING_DEFAULT_EDITOR] ?? settings[SETTING_EDITOR_BINARY] ?? DEFAULT_EDITOR_BINARY;
  const editorBinary =
    detectedEditors.find((editor) => editor.binary === configuredEditor)?.binary ??
    detectedEditors[0]?.binary ??
    configuredEditor;

  if (!hasActions) {
    return null;
  }

  const openPullRequest = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-github-session', {
        detail: { sessionId },
      }),
    );
  };

  const openEditor = async () => {
    if (worktreePath == null) {
      return;
    }
    try {
      await openInEditor(worktreePath, editorBinary);
    } catch (failure) {
      showToast('error', `couldn't open editor: ${formatError(failure)}`);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Eyebrow label="Shortcuts" muted className="px-0.5 font-medium" />
      <div className="flex flex-wrap gap-2">
        {rebase.canRebase ? (
          <button
            type="button"
            className={ACTION_CLASS}
            disabled={rebase.isRunning}
            onClick={() => void rebase.run()}
          >
            {rebase.isRunning ? (
              <LoaderCircle size={14} aria-hidden className="animate-spin" />
            ) : (
              <GitBranch size={14} aria-hidden />
            )}
            {rebase.isRunning ? 'Rebasing...' : 'Rebase on main'}
          </button>
        ) : null}
        {canPush ? (
          <button
            type="button"
            className={ACTION_CLASS}
            disabled={push.isBusy}
            onClick={() => void push.run()}
          >
            {push.isBusy ? (
              <LoaderCircle size={14} aria-hidden className="animate-spin" />
            ) : (
              <Upload size={14} aria-hidden />
            )}
            {push.isBusy ? 'Pushing...' : 'Push branch'}
          </button>
        ) : null}
        {canOpenPr ? (
          <button type="button" className={ACTION_CLASS} onClick={openPullRequest}>
            <GitPullRequest size={14} aria-hidden />
            Open PR
          </button>
        ) : null}
        {canOpenEditor ? (
          <button type="button" className={ACTION_CLASS} onClick={() => void openEditor()}>
            <FolderOpen size={14} aria-hidden />
            Open in editor
          </button>
        ) : null}
      </div>
      {rebase.error != null ? (
        <span role="alert" className="inline-flex items-center gap-1.5 text-xs text-danger">
          <AlertTriangle size={12} aria-hidden className="shrink-0" />
          {rebase.error}
        </span>
      ) : null}
      {push.error != null ? (
        <span role="alert" className="inline-flex items-center gap-1.5 text-xs text-danger">
          <AlertTriangle size={12} aria-hidden className="shrink-0" />
          {push.error}
        </span>
      ) : null}
    </div>
  );
};
