import type { ReactNode } from 'react';
import { ModelBlock, Tooltip, WORK_META_COLUMN, cn } from '@goodboy/ui';
import type { ModelsSummary } from '../../../../timeline/ranModels';
import { TimelineProviderGlyph } from './TimelineProviderGlyph';
import { ROW_CARD_REST_MS } from './timelineRowIdentity';

type Props = {
  readonly summary: ModelsSummary | null;
  readonly isPlanned?: boolean;
  readonly card?: ReactNode;
};

const MODEL_CELL = 'w-44 shrink-0 @max-[640px]:w-auto';

export const TimelineModelCell = ({ summary, isPlanned = false, card = null }: Props) => {
  if (summary === null) {
    return (
      <span
        aria-hidden
        data-meta-column="model"
        className={cn(WORK_META_COLUMN.modelInline, MODEL_CELL)}
      />
    );
  }
  const block = (
    <ModelBlock
      className={cn('cursor-default', MODEL_CELL)}
      layout="inline"
      isPlanned={isPlanned}
      name={summary.name}
      detail={summary.detail}
      glyphs={summary.providers.map((provider) => ({
        key: provider,
        node: <TimelineProviderGlyph provider={provider} isFaint={isPlanned} />,
      }))}
    />
  );
  if (card === null) {
    return block;
  }
  return (
    <Tooltip variant="card" side="bottom" restDelayMs={ROW_CARD_REST_MS} content={card}>
      {block}
    </Tooltip>
  );
};
