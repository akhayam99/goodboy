import { REVIEW_SOURCE_CAPABILITIES, REVIEW_SOURCE_LABEL } from '@goodboy/core/review-source';
import { Tooltip } from '@goodboy/ui';
import type { PullRequestHost } from '@goodboy/types';
import type { FixRunReady } from '../../fixRunReady';
import { fixRunReadyBody, fixesReadyText } from '../../fixRunReadyCopy';

type Props = {
  readonly ready: FixRunReady;
  readonly sourceKind: PullRequestHost | null;
};

export const FixRunReadyCount = ({ ready, sourceKind }: Props) => {
  const kind = sourceKind ?? 'github';
  return (
    <Tooltip
      content={fixRunReadyBody({
        ready,
        provider: REVIEW_SOURCE_LABEL[kind],
        canResolve: REVIEW_SOURCE_CAPABILITIES[kind].canResolve,
      })}
    >
      <span
        role="status"
        data-fix-run-ready=""
        className="whitespace-nowrap text-meta tabular-nums text-muted-foreground"
      >
        {fixesReadyText({ count: ready.threadIds.length })}
      </span>
    </Tooltip>
  );
};
