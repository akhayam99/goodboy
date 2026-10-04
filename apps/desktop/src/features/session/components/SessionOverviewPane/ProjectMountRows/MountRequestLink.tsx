import { useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import {
  PullRequestChip,
  pullRequestMeta,
} from '../../../../integrations/github/components/PullRequestChip';
import { REVIEW_TARGET_REASON_COPY } from '../../../../review/reviewTargetCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly label: string;
};

export const MountRequestLink = ({ sessionId, row, label }: Props) => {
  const openMountRequest = useAppStore((state) => state.openMountRequest);
  const [error, setError] = useState<string | null>(null);
  const request = row.request;

  if (request === null) {
    return null;
  }

  const state = request.isDraft ? 'draft' : request.state;

  return (
    <span className="flex min-w-0 shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label={`Open ${request.label} of ${label}`}
        onClick={() => {
          setError(null);
          void openMountRequest({
            sessionId,
            mountId: row.mountId,
            provider: request.provider,
            requestNumber: request.number,
          }).then((outcome) => {
            if (outcome.kind === 'unavailable' && outcome.reason !== 'superseded') {
              setError(REVIEW_TARGET_REASON_COPY[outcome.reason]);
              return;
            }
            if (outcome.kind === 'failed') {
              setError(outcome.error);
            }
          });
        }}
        className="flex min-w-0 shrink-0 items-center gap-2 rounded-md px-2 py-1 text-label hover:bg-hover"
      >
        <PullRequestChip state={state} iconSize={ICON_SIZE.row} />
        <span className="shrink-0 text-foreground tabular-nums">{request.label}</span>
        <span className="truncate text-muted-foreground @max-md:hidden">
          {pullRequestMeta({ state }).label}
        </span>
      </button>
      {error !== null && (
        <span role="status" className="min-w-0 truncate text-meta text-danger">
          {error}
        </span>
      )}
    </span>
  );
};
