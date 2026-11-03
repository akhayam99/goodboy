import { splitPeekPath } from './splitPeekPath';

type Props = {
  readonly path: string;
  readonly line?: number;
};

export const PeekPath = ({ path, line }: Props) => {
  const { directory, separator, name } = splitPeekPath({ path });
  return (
    <span
      data-peek-path=""
      className="flex min-w-0 max-w-[15rem] items-baseline whitespace-nowrap text-meta"
    >
      <span
        data-peek-directory=""
        data-truncates=""
        dir="rtl"
        className="min-w-0 shrink truncate text-left text-faint-foreground"
      >
        <bdi dir="ltr">
          {directory}
          {separator}
        </bdi>
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
