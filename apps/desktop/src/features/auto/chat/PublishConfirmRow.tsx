import { Button } from '@goodboy/ui';

type Props = {
  readonly branches: ReadonlyArray<string>;
  readonly isBusy: boolean;
  readonly onConfirm: () => void;
  readonly onDecline: () => void;
};

type LineParams = {
  readonly branches: ReadonlyArray<string>;
};

const lineOf = ({ branches }: LineParams): string => {
  const count = branches.length;
  const what = count === 1 ? 'Force push 1 branch' : `Force push ${count} branches`;
  return `${what}? ${branches.join(', ')}. Each earlier version is kept as a backup.`;
};

export const PublishConfirmRow = ({ branches, isBusy, onConfirm, onDecline }: Props) => (
  <div
    role="group"
    aria-label="Confirm the force push"
    className="flex min-w-0 items-center gap-3 text-meta text-foreground"
  >
    <p className="min-w-0 flex-1">{lineOf({ branches })}</p>
    <Button variant="ghost" size="sm" disabled={isBusy} onClick={onDecline}>
      Don&apos;t push
    </Button>
    <Button size="sm" disabled={isBusy} isBusy={isBusy} busyLabel="Pushing" onClick={onConfirm}>
      Force push
    </Button>
  </div>
);
