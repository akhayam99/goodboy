type Props = {
  readonly label: string;
  readonly rowIndex: number;
};

const RANGE_MARK = '@@';

type ContextParams = Pick<Props, 'label'>;

const contextOf = ({ label }: ContextParams): string => {
  const end = label.indexOf(RANGE_MARK, RANGE_MARK.length);
  return end === -1 ? label.trim() : label.slice(end + RANGE_MARK.length).trim();
};

export const HunkHeader = ({ label, rowIndex }: Props) => {
  const context = contextOf({ label });
  return (
    <div role="row" aria-rowindex={rowIndex} data-slot="diff-hunk" className="flex h-7 bg-subtle">
      <div
        role="gridcell"
        aria-label={label}
        className="flex min-w-0 flex-1 items-center truncate px-3 text-code text-faint-foreground"
      >
        {context}
      </div>
    </div>
  );
};
