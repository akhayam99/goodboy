import { Checkbox } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly count: number;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
};

export const ProjectFilterOption = ({ label, count, checked, onChange }: Props) => (
  <Checkbox
    checked={checked}
    onChange={onChange}
    ariaLabel={`Filter by ${label}`}
    className="w-full rounded px-2 py-1.5 hover:bg-foreground/5"
    label={
      <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <span className="truncate font-medium">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground/60">{count}</span>
      </span>
    }
  />
);
