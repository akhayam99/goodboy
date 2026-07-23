const LEVEL_TONES: Readonly<Record<string, string>> = {
  fatal: 'border-danger/40 bg-danger/10 text-danger',
  error: 'border-danger/40 bg-danger/10 text-danger',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  info: 'border-info/40 bg-info/10 text-info',
  debug: 'border-border-soft bg-muted/40 text-muted-foreground',
};

type Params = {
  readonly level: string | null;
};

export const levelTone = ({ level }: Params): string =>
  LEVEL_TONES[level?.toLowerCase() ?? ''] ?? 'border-border-soft bg-muted/40 text-muted-foreground';
