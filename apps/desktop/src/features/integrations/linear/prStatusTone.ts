type Params = {
  readonly status: string | null;
};

export const prStatusTone = ({ status }: Params): string => {
  switch (status?.toLowerCase()) {
    case 'merged':
      return 'border-primary/40 bg-primary/10 text-primary';
    case 'open':
      return 'border-success/40 bg-success/10 text-success';
    case 'draft':
      return 'border-border-soft bg-muted/50 text-muted-foreground';
    case 'closed':
      return 'border-danger/40 bg-danger/10 text-danger';
    default:
      return 'border-border-soft bg-muted/40 text-muted-foreground';
  }
};
