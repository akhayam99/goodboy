import { TriangleAlert } from 'lucide-react';
import type { EffortLevel, ProviderId } from '@goodboy/types';
import { Chip, Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { PROVIDER_BRAND } from '../../../provider-brand';
import {
  routingLabelParts,
  routingNameText,
} from '../../../../../../shared/components/RoutingPicker/routingSummary';

type Props = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel | null;
  readonly moreCount: number;
  readonly isPinned: boolean;
  readonly skippedReason: string | null;
};

export const RoleModelCells = ({
  provider,
  model,
  effort,
  moreCount,
  isPinned,
  skippedReason,
}: Props) => {
  const label = routingLabelParts({ provider, model, effort });
  const ProviderGlyph = PROVIDER_BRAND[provider].icon;
  return (
    <span className="flex shrink-0 items-center gap-3 text-label">
      <span data-role-summary className="flex w-44 min-w-0 items-center gap-2">
        <ProviderGlyph
          size={ICON_SIZE.row}
          className="shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="min-w-0 truncate text-foreground">{routingNameText(label)}</span>
        {moreCount > 0 ? (
          <span className="shrink-0 tabular-nums text-faint-foreground">+{moreCount}</span>
        ) : null}
      </span>
      <span data-role-effort className="w-16 shrink-0 truncate text-muted-foreground">
        {label.detail.join(' · ')}
      </span>
      <span className="flex w-20 shrink-0 items-center gap-1">
        <Chip kind="state" tone="neutral" label={isPinned ? 'Pinned' : 'Auto'} />
        {skippedReason === null ? null : (
          <Tooltip content={skippedReason}>
            <TriangleAlert
              size={ICON_SIZE.row}
              aria-label={skippedReason}
              role="img"
              className="shrink-0 text-warning"
            />
          </Tooltip>
        )}
      </span>
    </span>
  );
};
