import { Button } from '@goodboy/ui';

export const HandOff = ({
  line,
  label,
  busy,
  onOpen,
}: {
  readonly line: string;
  readonly label: string;
  readonly busy: boolean;
  readonly onOpen: () => void;
}) => (
  <div className="flex flex-col gap-3">
    <p className="text-body text-muted-foreground">{line}</p>
    <div>
      <Button variant="primary" disabled={busy} isBusy={busy} onClick={onOpen}>
        {label}
      </Button>
    </div>
  </div>
);
