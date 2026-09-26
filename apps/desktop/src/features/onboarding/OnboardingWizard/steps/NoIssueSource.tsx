import { Button } from '@goodboy/ui';

type Props = {
  readonly onBackToCodeHost: (() => void) | null;
  readonly onConnectTaskManager: (() => void) | null;
};

export const NoIssueSource = ({ onBackToCodeHost, onConnectTaskManager }: Props) => (
  <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle p-4">
    <div className="flex flex-col gap-1">
      <span className="text-row text-foreground">Connect a code host to see your tasks</span>
      <span className="text-secondary text-muted-foreground">
        Your issues come from GitHub, GitLab, or a task manager like Linear or Jira. You skipped
        both.
      </span>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {onBackToCodeHost !== null && (
        <Button size="sm" variant="primary" onClick={onBackToCodeHost}>
          Back to Code host
        </Button>
      )}
      {onConnectTaskManager !== null && (
        <Button size="sm" variant="secondary" onClick={onConnectTaskManager}>
          Connect a task manager
        </Button>
      )}
    </div>
    <span className="text-secondary text-faint-foreground">
      Or start without an issue: Run a workflow, or Ask an agent.
    </span>
  </div>
);
