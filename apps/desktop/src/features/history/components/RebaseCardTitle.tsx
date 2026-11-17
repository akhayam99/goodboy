import { Button } from '@goodboy/ui';

type Props = {
  readonly title: string;
  readonly onDismiss: (() => void) | null;
};

export const RebaseCardTitle = ({ title, onDismiss }: Props) => (
  <span className="flex min-w-0 items-center gap-2">
    <span className="min-w-0 flex-1 break-words">{title}</span>
    {onDismiss === null ? null : (
      <Button size="xs" variant="ghost" data-rebase-dismiss onClick={onDismiss}>
        Dismiss
      </Button>
    )}
  </span>
);
