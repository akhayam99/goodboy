import { Copy, FolderOpen, Plus, RotateCcw } from 'lucide-react';
import type { Agent, ResolveAttempt } from '@goodboy/types';
import type { CrumbMenuAction } from '@goodboy/ui';

type RetryStepParams = {
  readonly agent: Agent;
  readonly isTurnLive: boolean;
  readonly onRetry: () => void;
};

export const retryStepActions = ({
  agent,
  isTurnLive,
  onRetry,
}: RetryStepParams): ReadonlyArray<CrumbMenuAction> => {
  const isHalted = agent.status === 'failed' || agent.status === 'blocked';
  if (!isHalted || isTurnLive) {
    return [];
  }
  return [
    {
      id: 'retry-step',
      label: 'Retry step',
      icon: RotateCcw,
      hint: 'The same agent checks the step and finishes what is missing',
      confirm: null,
      onRun: onRetry,
    },
  ];
};

type ResolveAgainParams = {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly onRun: () => void;
};

export const resolveAgainActions = ({
  attempts,
  onRun,
}: ResolveAgainParams): ReadonlyArray<CrumbMenuAction> => {
  const isLive = attempts.some(
    (attempt) => attempt.phase === 'queued' || attempt.phase === 'running',
  );
  if (isLive) {
    return [];
  }
  return [
    {
      id: 'resolve-again',
      label: 'Resolve again',
      icon: RotateCcw,
      hint: 'A new attempt reads this comment again and proposes a fix',
      confirm: null,
      onRun,
    },
  ];
};

type NewArtifactParams = {
  readonly onRun: () => void;
};

export const newArtifactAction = ({ onRun }: NewArtifactParams): CrumbMenuAction => ({
  id: 'new-artifact',
  label: 'New artifact',
  icon: Plus,
  confirm: null,
  onRun,
});

type SavedCopyParams = {
  readonly hasWorkspace: boolean;
  readonly onReveal: () => void;
  readonly onCopyPath: () => void;
};

export const savedCopyActions = ({
  hasWorkspace,
  onReveal,
  onCopyPath,
}: SavedCopyParams): ReadonlyArray<CrumbMenuAction> =>
  hasWorkspace
    ? [
        {
          id: 'reveal-saved-copy',
          label: 'Show saved copy',
          icon: FolderOpen,
          confirm: null,
          onRun: onReveal,
        },
        {
          id: 'copy-saved-path',
          label: 'Copy folder path',
          icon: Copy,
          confirm: null,
          onRun: onCopyPath,
        },
      ]
    : [];
