import { cn, tintClasses, FOCUS_RING } from '@goodboy/ui';

type ShellParams = {
  readonly selected?: boolean;
  readonly active?: boolean;
  readonly dimmed?: boolean;
};

const restBorder = ({ selected }: Pick<ShellParams, 'selected'>): string => {
  if (selected === true) {
    return cn('border-primary', tintClasses('primary').bgSoft);
  }
  return 'border-border-soft hover:border-border hover:bg-hover';
};

export const sessionCardShell = ({ selected, active, dimmed }: ShellParams): string =>
  cn(
    'relative rounded-lg border bg-elevated text-foreground transition-colors',
    FOCUS_RING,
    active === true ? 'border-border shadow-sm' : restBorder({ selected }),
    dimmed === true && 'opacity-50',
  );
