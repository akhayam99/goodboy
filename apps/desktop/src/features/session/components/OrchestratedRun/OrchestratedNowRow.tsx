import { TailGlyph } from '../../../live-state/TailGlyph';
import { OrchestratedPlanSlot } from './OrchestratedPlanSlot';

type Props = {
  readonly phrase: string;
  readonly slotWidth: number;
};

export const OrchestratedNowRow = ({ phrase, slotWidth }: Props) => (
  <div role="status" data-plan-row="now" className="flex h-8 min-w-0 items-center">
    <OrchestratedPlanSlot slotWidth={slotWidth}>
      <TailGlyph state="working" />
    </OrchestratedPlanSlot>
    <span className="min-w-0 flex-1 truncate px-2 text-ui text-foreground motion-safe:text-shimmer">
      {phrase}
    </span>
  </div>
);
