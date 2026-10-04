import { formatUsd } from '@goodboy/ui';
import { ProviderIcon } from '../../../../providers/components/ProviderIcon';
import { modelLabel } from '../../../../chat/utils/chat-constants';
import { formatDuration } from '../../../../../shared/utils/time/formatDuration';
import type { IssueBriefRoute } from '../../../../../store/slices/issue-briefs/types';

type Props = {
  readonly route: IssueBriefRoute;
  readonly durationMs: number;
  readonly costUsd: number;
};

export const BriefMeta = ({ route, durationMs, costUsd }: Props) => (
  <span className="flex shrink-0 items-center gap-1 text-meta text-faint-foreground tabular-nums">
    <ProviderIcon provider={route.providerId} variant="glyph" />
    <span>{modelLabel(route.model, route.providerId)}</span>
    <span aria-hidden>·</span>
    <span>{formatDuration({ durationMs })}</span>
    {costUsd > 0 && (
      <>
        <span aria-hidden>·</span>
        <span>{formatUsd(costUsd)}</span>
      </>
    )}
  </span>
);
