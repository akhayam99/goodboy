import { useEffect, useState } from 'react';
import { Button, Notice } from '@goodboy/ui';
import type {
  MountBranchObservation,
  MountBranchResolution,
  MountId,
  SessionId,
} from '@goodboy/types';
import { worktreeBranchHolder } from '../../../../worktree/worktree';
import { useAppStore } from '../../../../../store';
import type { MountBranchHolder } from '../../../../../store/slices/project-mounts/mountRowModel';
import { buildBranchDecision, splitOnBranches } from './branchDecision';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly projectName: string;
  readonly repoRoot: string;
  readonly worktreePath: string | null;
  readonly observation: MountBranchObservation;
  readonly holder: MountBranchHolder | null;
};

type ResolveParams = {
  readonly resolution: MountBranchResolution;
};

export const MountBranchDecision = ({
  sessionId,
  mountId,
  projectName,
  repoRoot,
  worktreePath,
  observation,
  holder,
}: Props) => {
  const resolveMountBranchMismatch = useAppStore((state) => state.resolveMountBranchMismatch);
  const reportError = useAppStore((state) => state.reportError);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [resolvedHolder, setResolvedHolder] = useState<MountBranchHolder | 'checking' | null>(
    holder ?? 'checking',
  );
  const targetBranch =
    observation.state === 'mismatch' ? observation.observedBranch : observation.recordedBranch;

  useEffect(() => {
    if (observation.state === 'unavailable' || targetBranch === null || worktreePath === null) {
      setResolvedHolder(null);
      return;
    }
    if (holder !== null) {
      setResolvedHolder(holder);
      return;
    }
    let isCancelled = false;
    setResolvedHolder('checking');
    void worktreeBranchHolder({ repoPath: repoRoot, branch: targetBranch })
      .then((holderPath) => {
        if (isCancelled) {
          return;
        }
        setResolvedHolder(
          holderPath !== null && holderPath !== worktreePath
            ? { mountId: null, label: null }
            : null,
        );
      })
      .catch(() => {
        if (!isCancelled) {
          setResolvedHolder(null);
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [holder, observation.state, repoRoot, targetBranch, worktreePath]);

  const decision = buildBranchDecision({ observation, projectName, holder: resolvedHolder });

  if (isDismissed || decision === null) {
    return null;
  }

  const alt = decision.alt;

  const resolve = async ({ resolution }: ResolveParams) => {
    setIsBusy(true);
    try {
      await resolveMountBranchMismatch({ sessionId, mountId, resolution });
      setIsDismissed(true);
    } catch (error) {
      void reportError({ title: "Couldn't settle the branch mismatch", error, sessionId });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Notice
      tone="warning"
      placement="inline"
      role="alert"
      title={decision.title}
      body={
        <span className="break-words">
          {splitOnBranches({
            text: decision.description,
            branches: [observation.recordedBranch, observation.observedBranch],
          }).map((segment, index) =>
            segment.isBranch ? (
              <span key={`${index}:${segment.text}`} className="break-all text-code">
                {segment.text}
              </span>
            ) : (
              segment.text
            ),
          )}
        </span>
      }
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            disabled={isBusy || decision.confirm.isDisabled}
            onClick={() => void resolve({ resolution: decision.confirm.resolution })}
          >
            {decision.confirm.label}
          </Button>
          {alt === null ? null : (
            <Button
              variant="secondary"
              size="sm"
              disabled={isBusy || alt.isDisabled}
              onClick={() => void resolve({ resolution: alt.resolution })}
            >
              {alt.label}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={isBusy}
            onClick={() => setIsDismissed(true)}
          >
            Not now
          </Button>
        </>
      }
    />
  );
};
