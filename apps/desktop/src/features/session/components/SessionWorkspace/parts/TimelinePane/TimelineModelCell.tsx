import type { ReactNode } from 'react';
import { Tooltip, WORK_META_COLUMN, cn } from '@goodboy/ui';
import type { ModelsSummary } from '../../../../timeline/ranModels';
import { TriggerSeparator } from '../../../../../../shared/components/RoutingPicker/TriggerSeparator';
import { TimelineProviderGlyph } from './TimelineProviderGlyph';
import { ROW_CARD_REST_MS } from './timelineRowIdentity';

type Props = {
  readonly summary: ModelsSummary | null;
  readonly isPlanned?: boolean;
  readonly card?: ReactNode;
};

export const TimelineModelCell = ({ summary, isPlanned = false, card = null }: Props) => {
  if (summary === null) {
    return <span aria-hidden data-meta-column="model" className={WORK_META_COLUMN.model} />;
  }
  const cell = (
    <span
      data-meta-column="model"
      className={cn(
        WORK_META_COLUMN.model,
        'cursor-default text-meta',
        isPlanned ? 'text-faint-foreground' : 'text-muted-foreground',
      )}
    >
      <span className="flex shrink-0 items-center gap-0.5">
        {summary.providers.map((provider) => (
          <TimelineProviderGlyph key={provider} provider={provider} isFaint={isPlanned} />
        ))}
      </span>
      <span data-routing-part="name" className={WORK_META_COLUMN.modelName}>
        {summary.text}
      </span>
      {summary.effort == null ? null : (
        <span className={WORK_META_COLUMN.modelDetail}>
          <TriggerSeparator />
          <span data-routing-part="detail">{summary.effort}</span>
        </span>
      )}
    </span>
  );
  if (card === null) {
    return cell;
  }
  return (
    <Tooltip variant="card" side="bottom" restDelayMs={ROW_CARD_REST_MS} content={card}>
      {cell}
    </Tooltip>
  );
};
