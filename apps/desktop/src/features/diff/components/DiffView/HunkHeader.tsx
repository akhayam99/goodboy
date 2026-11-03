import { hunkContextOf } from '../../lib/hunkContextOf';

type Props = {
  readonly label: string;
  readonly rowIndex: number;
};

export const HunkHeader = ({ label, rowIndex }: Props) => (
  <div role="row" aria-rowindex={rowIndex} data-slot="diff-hunk" className="flex h-7 bg-subtle">
    <div
      role="gridcell"
      aria-label={label}
      className="flex min-w-0 flex-1 items-center truncate px-3 text-code text-faint-foreground"
    >
      {hunkContextOf({ label })}
    </div>
  </div>
);
