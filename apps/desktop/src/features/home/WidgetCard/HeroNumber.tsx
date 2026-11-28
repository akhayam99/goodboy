type Props = {
  readonly value: string;
  readonly unit: string;
};

export const HeroNumber = ({ value, unit }: Props) => (
  <span className="flex min-w-0 items-baseline gap-1">
    <span className="text-display tabular-nums text-foreground">{value}</span>
    <span className="truncate text-meta text-muted-foreground">{unit}</span>
  </span>
);
