import { useCallback, useEffect, useState } from 'react';
import { formatError } from '@goodboy/ui';
import { useShallow } from 'zustand/react/shallow';
import { parseUnifiedDiff } from '@goodboy/core/github';
import type {
  FileDiff,
  GitlabIntegrationBinding,
  MountId,
  Session,
  SessionId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ReviewTarget } from '../../../../store/slices/review-drafts/resolveReviewTarget';
import { mountReviewOf } from '../../mountReviewOf';
import { ghPrDiff } from '../../../integrations/github/github';
import { gitlabMrDiff } from '../../../integrations/gitlab/client';
import { orderLikeTree } from '../../../diff/lib/changeTree';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';

type Params = {
  readonly session: Session;
  readonly mountId: MountId | null;
};

type Result = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly loading: boolean;
  readonly error: string | null;
  readonly target: ReviewTarget | null;
  readonly refresh: () => void;
};

export const useReviewDiff = ({ session, mountId }: Params): Result => {
  const sessionId = session.id as SessionId;
  const target = useAppStore((state) => mountReviewOf({ state, sessionId, mountId }).target);
  const isTargetLoaded = useAppStore((s) => s.sessionExternalTasks[sessionId] !== undefined);
  const workspace = useAppStore(
    (s) => s.workspaces.find((candidate) => candidate.id === session.workspaceId) ?? null,
  );
  const repo = useAppStore(
    useShallow((state) =>
      resolveSessionRepo({ state, sessionId, ...(mountId === null ? {} : { mountId }) }),
    ),
  );
  const gitlabHost = useAppStore(
    (s) =>
      (s.workspaceIntegrations[session.workspaceId] ?? []).find(
        (integration): integration is GitlabIntegrationBinding => integration.provider === 'gitlab',
      )?.config.host ?? null,
  );
  const [files, setFiles] = useState<ReadonlyArray<FileDiff>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (target == null) {
      setFiles([]);
      setLoading(!isTargetLoaded);
      setError(null);
      return;
    }
    if (workspace == null || repo == null) {
      setFiles([]);
      setLoading(false);
      setError('No repository is in this session yet.');
      return;
    }
    const fetchDiff =
      target.provider === 'github'
        ? () => ghPrDiff(target.repo, target.prNumber, repo.repoRoot, workspace.id, repo.projectId)
        : gitlabHost == null
          ? null
          : () => gitlabMrDiff(workspace.id, gitlabHost, target.repo, target.prNumber);
    if (fetchDiff == null) {
      setFiles([]);
      setLoading(false);
      setError("GitLab isn't connected for this workspace.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchDiff()
      .then((raw) => {
        if (cancelled) {
          return;
        }
        setFiles(orderLikeTree({ files: parseUnifiedDiff(raw) }));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setError(formatError(err));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gitlabHost, isTargetLoaded, repo, target, tick, workspace]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  return { files, loading, error, target, refresh };
};
