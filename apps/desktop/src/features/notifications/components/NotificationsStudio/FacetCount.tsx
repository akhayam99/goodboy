import { countSlotText } from '../../../../shared/utils/countSlotText';

type Props = {
  readonly count: number;
};

export const FacetCount = ({ count }: Props) => (
  <span className="shrink-0 text-chip tabular-nums text-faint-foreground">
    {countSlotText({ count, isBesideGlyph: true })}
  </span>
);
