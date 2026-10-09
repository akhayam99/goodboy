import { Button } from '@goodboy/ui';

export const HandOff = ({
  line,
  busy,
  onOpen,
}: {
  readonly line: string;
  readonly busy: boolean;
  readonly onOpen: () => void;
}) => (
  <div className="flex flex-col gap-3">
    <p className="text-body text-muted-foreground">{line}</p>
    <div>
      <Button size="md" variant="primary" disabled={busy} isBusy={busy} onClick={onOpen}>
        Open a new session
      </Button>
    </div>
  </div>
);
