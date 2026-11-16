import { RotateCcw } from '@goodboy/ui/icons';
import { Button, ICON_SIZE } from '@goodboy/ui';

type Props = {
  readonly sentence: string;
  readonly onRetry: () => void;
};

export const ArtifactLoadFailed = ({ sentence, onRetry }: Props) => (
  <div
    role="alert"
    data-testid="artifact-load-failed"
    className="flex min-w-0 items-center justify-between gap-3"
  >
    <p className="min-w-0 text-meta text-muted-foreground">{sentence}</p>
    <Button size="sm" variant="ghost" onClick={onRetry}>
      <RotateCcw size={ICON_SIZE.row} aria-hidden />
      Retry
    </Button>
  </div>
);
