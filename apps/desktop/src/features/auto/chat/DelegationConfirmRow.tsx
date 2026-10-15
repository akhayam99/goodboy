import { Button } from '@goodboy/ui';

type Props = {
  readonly line: string;
  readonly isBusy: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

export const DelegationConfirmRow = ({ line, isBusy, onConfirm, onCancel }: Props) => (
  <div
    role="group"
    aria-label="Confirm this work"
    className="flex min-w-0 items-center gap-3 text-label text-foreground"
  >
    <p className="min-w-0 flex-1">{line}</p>
    <Button variant="ghost" size="sm" disabled={isBusy} onClick={onCancel}>
      Cancel
    </Button>
    <Button size="sm" disabled={isBusy} isBusy={isBusy} busyLabel="Confirming" onClick={onConfirm}>
      Confirm
    </Button>
  </div>
);
