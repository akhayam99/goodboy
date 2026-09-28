import { useState } from 'react';
import { Button } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { mountRequestOf } from '../../../../store/slices/project-mounts/mountRowModel';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { REVIEW_TARGET_REASON_COPY } from '../../../review/reviewTargetCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export const DiffPullRequestLink = ({ sessionId, mountId }: Props) => {
  const openMountRequest = useAppStore((s) => s.openMountRequest);
  const provider = useAppStore((s) => mountRequestOf({ state: s, mountId })?.provider ?? null);
  const number = useAppStore((s) => mountRequestOf({ state: s, mountId })?.number ?? null);
  const label = useAppStore((s) => mountRequestOf({ state: s, mountId })?.label ?? null);
  const [error, setError] = useState<string | null>(null);

  if (provider === null || number === null || label === null) {
    return null;
  }

  const Icon = CONCEPT_ICONS.pr;

  return (
    <span className="flex min-w-0 items-center gap-2">
      {error !== null && (
        <span role="status" className="min-w-0 truncate text-secondary text-danger">
          {error}
        </span>
      )}
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Open ${label}`}
        onClick={() => {
          setError(null);
          void openMountRequest({ sessionId, mountId, provider, requestNumber: number }).then(
            (outcome) => {
              if (outcome.kind === 'unavailable' && outcome.reason !== 'superseded') {
                setError(REVIEW_TARGET_REASON_COPY[outcome.reason]);
                return;
              }
              if (outcome.kind === 'failed') {
                setError(outcome.error);
              }
            },
          );
        }}
      >
        <Icon size={ICON_SIZE.row} aria-hidden />
        {label}
      </Button>
    </span>
  );
};
