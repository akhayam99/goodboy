import { RotateCcw, TriangleAlert } from '@goodboy/ui/icons';
import { Button, EmptyState, ICON_SIZE } from '@goodboy/ui';

type Props = {
  readonly title: string;
  readonly onRetry: () => void;
};

export const ContextLoadFailure = ({ title, onRetry }: Props) => {
  return (
    <EmptyState
      size="section"
      icon={TriangleAlert}
      tone="warning"
      title={`${title} didn't load`}
      description="Goodboy couldn't read it. Nothing in the session was changed."
      action={
        <Button size="sm" variant="ghost" onClick={onRetry}>
          <RotateCcw size={ICON_SIZE.control} aria-hidden />
          Retry
        </Button>
      }
    />
  );
};
