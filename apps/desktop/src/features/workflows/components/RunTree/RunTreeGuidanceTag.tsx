import { SlidersHorizontal } from 'lucide-react';
import { cn, ICON_SIZE, tintClasses, Tooltip } from '@goodboy/ui';
import { guidanceTagTip } from '../../../../store/slices/workflows/standingGuidance';

type Props = {
  readonly text: string;
};

export const RunTreeGuidanceTag = ({ text }: Props) => (
  <Tooltip content={guidanceTagTip({ text })} side="top">
    <span
      aria-label={`Guidance: ${guidanceTagTip({ text })}`}
      className={cn(
        'pointer-events-auto inline-flex shrink-0 cursor-default items-center gap-1 text-chip',
        tintClasses('info').text,
      )}
    >
      <SlidersHorizontal size={ICON_SIZE.mark} aria-hidden />
      Guidance
    </span>
  </Tooltip>
);
