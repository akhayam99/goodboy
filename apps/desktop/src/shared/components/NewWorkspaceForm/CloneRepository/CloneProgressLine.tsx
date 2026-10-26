import { Button, Meter } from '@goodboy/ui';

type Props = {
  readonly phase: string;
  readonly percent: number | null;
  readonly onCancel: () => void;
};

export const CloneProgressLine = ({ phase, percent, onCancel }: Props) => (
  <div role="status" className="flex items-center justify-between gap-3">
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-meta text-muted-foreground">
        {percent === null ? phase : `${phase} ${percent}%`}
      </span>
      {percent === null ? null : <Meter label={phase} value={percent} size="xs" />}
    </div>
    <Button variant="ghost" size="xs" onClick={onCancel}>
      Cancel
    </Button>
  </div>
);
