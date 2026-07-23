const PRIORITY_TONES: Readonly<Record<number, string>> = {
  1: 'bg-danger',
  2: 'bg-warning',
  3: 'bg-info',
  4: 'bg-muted-foreground/50',
};

type Params = {
  readonly priority: number | null | undefined;
};

export const priorityTone = ({ priority }: Params): string =>
  priority == null
    ? 'bg-muted-foreground/30'
    : (PRIORITY_TONES[priority] ?? 'bg-muted-foreground/30');
