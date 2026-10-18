import { Button } from '@goodboy/ui';

type Props = {
  readonly onOpenTools: (() => void) | null;
};

export const NoIssueSource = ({ onOpenTools }: Props) => (
  <p className="flex flex-wrap items-center gap-1 text-meta text-faint-foreground">
    To pick up an issue instead, connect where your tasks live.
    {onOpenTools === null ? null : (
      <Button size="xs" variant="quiet" onClick={onOpenTools}>
        Open Tools
      </Button>
    )}
  </p>
);
