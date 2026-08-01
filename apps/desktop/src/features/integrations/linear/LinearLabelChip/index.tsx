import type { LinearIssueLabel } from '../client';

type Props = {
  readonly label: LinearIssueLabel;
};

export const LinearLabelChip = ({ label }: Props) => {
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
      <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: label.color }} />
      {label.name}
    </span>
  );
};
