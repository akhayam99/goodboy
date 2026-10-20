import { Tooltip } from '@goodboy/ui';
import type { RunWorkflowKind } from '../../../../timeline/runWorkflowKind';
import { RUN_KIND_GLYPH } from './runKindGlyph';
import { TimelineRunGlyph } from './TimelineRunGlyph';
import type { TimelineRowIdentity } from './timelineRowIdentity';

type Props = {
  readonly kind: RunWorkflowKind;
  readonly workflowName: string;
  readonly muted?: boolean;
  readonly identity?: TimelineRowIdentity | null;
  readonly isCardOpen?: boolean;
};

export const TimelineRunChip = ({
  kind,
  workflowName,
  muted = false,
  identity = null,
  isCardOpen = false,
}: Props) => {
  const { label, isNamedInTooltip } = RUN_KIND_GLYPH[kind];
  const name = workflowName.trim();
  const tooltip = isNamedInTooltip && name.length > 0 ? `${name} ${label.toLowerCase()}` : label;
  const glyph = <TimelineRunGlyph kind={kind} label={tooltip} isMuted={muted} />;
  if (identity === null) {
    return <Tooltip content={tooltip}>{glyph}</Tooltip>;
  }
  return identity.wrapCard({ children: glyph, isOpen: isCardOpen });
};
