import type { ReactNode } from 'react';
import { Tooltip, cn } from '@goodboy/ui';
import type { ModelsSummary } from '../../../../timeline/ranModels';
import { TimelineProviderGlyph } from './TimelineProviderGlyph';
import { ROW_CARD_REST_MS } from './timelineRowIdentity';

type Props = {
  readonly summary: ModelsSummary | null;
  readonly isPlanned?: boolean;
  readonly card?: ReactNode;
};

const MODEL_CELL =
  'flex w-44 min-w-0 shrink-0 items-center gap-2 overflow-hidden text-meta @max-[500px]:hidden';

const MAX_GLYPHS = 3;

export const TimelineModelCell = ({ summary, isPlanned = false, card = null }: Props) => {
  if (summary === null) {
    return <span aria-hidden data-meta-column="model" className={MODEL_CELL} />;
  }
  const block = (
    <span
      data-meta-column="model"
      className={cn(
        MODEL_CELL,
        'cursor-default',
        isPlanned ? 'text-faint-foreground' : 'text-muted-foreground',
      )}
    >
      {summary.providers.slice(0, MAX_GLYPHS).map((provider) => (
        <TimelineProviderGlyph key={provider} provider={provider} isFaint={isPlanned} />
      ))}
      <span data-routing-part="name" className="min-w-0 truncate">
        {summary.name}
      </span>
      {summary.detail === null || summary.detail === '' ? null : (
        <>
          <span aria-hidden className="shrink-0 text-faint-foreground">
            ·
          </span>
          <span data-routing-part="detail" className="shrink-0 text-faint-foreground">
            {summary.detail}
          </span>
        </>
      )}
    </span>
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
