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
    <div className="flex shrink-0 items-center gap-2 text-meta text-faint-foreground">
      <span>{count} hidden by filters</span>
      <Button variant="ghost" size="xs" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
};
