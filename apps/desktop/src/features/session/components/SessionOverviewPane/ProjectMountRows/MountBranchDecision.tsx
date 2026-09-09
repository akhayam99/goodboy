import { useEffect, useState } from 'react';
import { GitBranch } from 'lucide-react';
import { InlineConfirm, formatError } from '@goodboy/ui';
import type {
  MountBranchObservation,
  MountBranchResolution,
  MountId,
  SessionId,
} from '@goodboy/types';
import { useToast } from '../../../../../app/components/Toast';
import { worktreeBranchHolder } from '../../../../worktree/worktree';
import { useAppStore } from '../../../../../store';
import type { MountBranchHolder } from '../../../../../store/slices/project-mounts/mountRowModel';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { buildBranchDecision } from './branchDecision';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly mountLabel: string;
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
  mountLabel,
  repoRoot,
  worktreePath,
  observation,
  holder,
}: Props) => {
  const resolveMountBranchMismatch = useAppStore((state) => state.resolveMountBranchMismatch);
  const { showToast } = useToast();
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

  const decision = buildBranchDecision({ observation, mountLabel, holder: resolvedHolder });

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
      showToast('error', formatError(error));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <InlineConfirm
      role="alert"
      icon={<GitBranch size={ICON_SIZE.row} aria-hidden />}
      title={decision.title}
      description={decision.description}
      confirmLabel={decision.confirm.label}
      cancelLabel="Not now"
      isBusy={isBusy}
      isConfirmDisabled={decision.confirm.isDisabled}
      note={
        <ul className="flex flex-col gap-1 text-muted-foreground">
          {decision.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      }
      {...(alt === null
        ? {}
        : {
            altAction: {
              label: alt.label,
              disabled: alt.isDisabled,
              onClick: () => void resolve({ resolution: alt.resolution }),
            },
          })}
      onConfirm={() => resolve({ resolution: decision.confirm.resolution })}
      onCancel={() => setIsDismissed(true)}
    />
  );
};
