import { RotateCcw, TriangleAlert } from 'lucide-react';
import { Button, LensEmptyState } from '@goodboy/ui';

type Props = {
  readonly title: string;
  readonly onRetry: () => void;
};

export const ContextLoadFailure = ({ title, onRetry }: Props) => {
  return (
    <LensEmptyState
      icon={TriangleAlert}
      tone="warning"
      title={`${title} did not load`}
      description="The database did not answer, so this is not what the session holds. Nothing here is missing on purpose."
      action={
        <Button size="sm" variant="ghost" onClick={onRetry}>
          <RotateCcw size={14} aria-hidden />
          Retry
        </Button>
      }
    />
  );
};
