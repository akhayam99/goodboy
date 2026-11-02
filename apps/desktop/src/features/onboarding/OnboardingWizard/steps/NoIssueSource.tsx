import { Button } from '@goodboy/ui';

type Props = {
  readonly onConnect: (() => void) | null;
};

export const NoIssueSource = ({ onConnect }: Props) => (
  <p className="flex flex-wrap items-center gap-1 text-meta text-faint-foreground">
    To pick up an issue instead, connect where your tasks live.
    {onConnect === null ? null : (
      <Button size="xs" variant="quiet" onClick={onConnect} data-demo-anchor="setup-open-tools">
        Connect Linear or Jira
      </Button>
    )}
  </p>
);
