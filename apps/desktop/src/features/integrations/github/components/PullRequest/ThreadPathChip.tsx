import { Tooltip } from '@goodboy/ui';

type Props = {
  readonly path: string;
  readonly line: number | null;
  readonly onOpen: () => void;
};

export const ThreadPathChip = ({ path, line, onOpen }: Props) => {
  const suffix = line != null ? `:${line}` : '';
  return (
    <Tooltip content={`${path}${suffix}`}>
      <button
        type="button"
        onClick={onOpen}
        className="block w-fit max-w-full truncate rounded-sm bg-background px-2 py-0.5 text-left font-mono text-chip text-muted-foreground hover:text-foreground"
      >
        {path}
        {suffix}
      </button>
    </Tooltip>
  );
};
