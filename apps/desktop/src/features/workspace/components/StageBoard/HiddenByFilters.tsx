import { Button } from '@goodboy/ui';

type Props = {
  readonly count: number;
  readonly onClear: () => void;
};

export const HiddenByFilters = ({ count, onClear }: Props) => {
  if (count <= 0) {
    return null;
  }
  return (
    <div
      data-hidden-by-filters=""
      className="flex shrink-0 items-center gap-1 text-meta text-faint-foreground"
    >
      <span className="tabular-nums">{`${count} hidden`}</span>
      <span aria-hidden>·</span>
      <Button variant="ghost" size="xs" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
};
