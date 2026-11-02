import { splitPeekPath } from './splitPeekPath';

type Props = {
  readonly path: string;
  readonly line?: number;
};

export const PeekPath = ({ path, line }: Props) => {
  const { directory, separator, name } = splitPeekPath({ path });
  return (
    <span data-peek-path="" className="flex min-w-0 max-w-[15rem] items-baseline text-meta">
      <span
        data-peek-directory=""
        data-truncates=""
        className="min-w-0 truncate text-faint-foreground"
      >
        {directory}
        {separator}
      </span>
      <span data-peek-name="" className="shrink-0 text-foreground">
        {name}
      </span>
      {line === undefined ? null : (
        <span className="shrink-0 tabular-nums text-faint-foreground">:{line}</span>
      )}
    </span>
  );
};
