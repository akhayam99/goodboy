import { RotateCcw, TriangleAlert } from 'lucide-react';
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
      title={`${title} did not load`}
      description="The database did not answer, so this isn't what the session holds. Nothing here is missing on purpose."
      action={
        <Button size="sm" variant="ghost" onClick={onRetry}>
          <RotateCcw size={ICON_SIZE.control} aria-hidden />
          Retry
        </Button>
      }
    />
  );
};
