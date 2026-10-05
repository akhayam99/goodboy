import { Tooltip, cn } from '@goodboy/ui';
import type { RunWorkflowKind } from '../../../../timeline/runWorkflowKind';
import { RUN_KIND_GLYPH } from './runKindGlyph';
import { ROW_CARD_REST_MS, type TimelineRowIdentity } from './timelineRowIdentity';

type Props = {
  readonly kind: RunWorkflowKind;
  readonly workflowName: string;
  readonly muted?: boolean;
  readonly identity?: TimelineRowIdentity | null;
  readonly isCardOpen?: boolean;
};

const GLYPH_SIZE = 10;

export const TimelineRunChip = ({
  kind,
  workflowName,
  muted = false,
  identity = null,
  isCardOpen = false,
}: Props) => {
  const { icon: Icon, label, isNamedInTooltip } = RUN_KIND_GLYPH[kind];
  const name = workflowName.trim();
  const tooltip = isNamedInTooltip && name.length > 0 ? `${name} ${label.toLowerCase()}` : label;
  const glyph = (
    <span
      role="img"
      aria-label={tooltip}
      title={identity === null ? tooltip : undefined}
      data-testid="run-glyph"
      className={cn(
        'inline-flex size-4.5 shrink-0 items-center justify-center self-center rounded-full bg-current/12 motion-safe:transition-colors',
        muted ? 'text-faint-foreground' : 'text-muted-foreground',
      )}
    >
      <Icon size={GLYPH_SIZE} aria-hidden />
    </span>
  );
  if (identity === null) {
    return glyph;
  }
  return (
    <Tooltip
      variant="card"
      side="bottom"
      restDelayMs={ROW_CARD_REST_MS}
      isOpen={isCardOpen}
      content={identity.card}
    >
      {glyph}
    </Tooltip>
  );
};
