type Props = {
  readonly label: string;
  readonly rowIndex: number;
};

export const HunkHeader = ({ label, rowIndex }: Props) => (
  <div role="row" aria-rowindex={rowIndex} data-slot="diff-hunk" className="flex h-7 bg-subtle">
    <div
      role="gridcell"
      className="flex min-w-0 flex-1 items-center truncate px-3 font-sans text-2xs tabular-nums text-faint-foreground"
    >
      {label}
    </div>
  </div>
);
