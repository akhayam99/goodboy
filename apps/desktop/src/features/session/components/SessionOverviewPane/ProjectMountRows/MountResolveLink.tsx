import { useMemo, useState } from 'react';
import type { ResolveThread, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { eligibleReviewThreadCount } from '../../../../suggestions/eligibleThreads';
import { REVIEW_TARGET_REASON_COPY } from '../../../../review/reviewTargetCopy';
import { mountReviewGithub } from '../../../../review/mountReviewGithub';
import { NAMES } from '../../../../../shared/names';

type Props = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly label: string;
};

const EMPTY_ROWS: ReadonlyArray<ResolveThread> = [];

export const MountResolveLink = ({ sessionId, row, label }: Props) => {
  const openReviewTarget = useAppStore((state) => state.openReviewTarget);
  const github = useAppStore((state) =>
    mountReviewGithub({ state, sessionId, mountId: row.mountId }),
  );
  const rows = useAppStore((state) => state.sessionResolveThreads[sessionId] ?? EMPTY_ROWS);
  const [error, setError] = useState<string | null>(null);
  const request = row.request;
  const prNumber = request?.provider === 'github' ? request.number : null;
  const count = useMemo(
    () =>
      prNumber === null || github?.pr?.number !== prNumber
        ? 0
        : eligibleReviewThreadCount({ github, rows }),
    [github, prNumber, rows],
  );

  if (prNumber === null || count === 0) {
    return null;
  }

  const Icon = CONCEPT_ICONS.comments;

  return (
    <span className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label={`Open ${NAMES.comments} for ${label}, ${count} to resolve`}
        onClick={() => {
          setError(null);
          void openReviewTarget({
            sessionId,
            destination: { kind: 'comments', mountId: row.mountId, prNumber },
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
        className="flex shrink-0 items-center gap-2 rounded-md px-2 py-1 text-label text-foreground tabular-nums hover:bg-hover"
      >
        <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
        {`${count} to resolve`}
      </button>
      {error !== null && (
        <span role="status" className="min-w-0 truncate text-meta text-danger">
          {error}
        </span>
      )}
    </span>
  );
};
