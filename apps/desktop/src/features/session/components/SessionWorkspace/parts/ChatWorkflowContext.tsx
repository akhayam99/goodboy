import { Divider } from '@goodboy/ui';

type Props = {
  readonly workflowName: string;
  readonly onOpenWorkflow: () => void;
};

export const ChatWorkflowContext = ({ workflowName, onOpenWorkflow }: Props) => (
  <>
    <div className="flex h-[var(--chat-header-h)] shrink-0 items-center px-3 text-2xs text-muted-foreground">
      <span className="min-w-0 truncate">
        Part of{' '}
        <button
          type="button"
          onClick={onOpenWorkflow}
          className="font-medium text-muted-foreground transition-colors hover:text-foreground"
          title={workflowName}
        >
          {workflowName}
        </button>
      </span>
    </div>
    <Divider className="shrink-0" />
  </>
);
