import { Button } from '@goodboy/ui';

type Props = {
  readonly onOpenAuto: () => void;
};

export const AutoChildNotice = ({ onOpenAuto }: Props) => (
  <div className="flex min-w-0 items-center gap-3 text-label text-muted-foreground">
    <p className="min-w-0 flex-1">
      Started by Auto. You can read and stop it here. To change what it does, tell Auto.
    </p>
    <Button variant="secondary" size="sm" onClick={onOpenAuto}>
      Open Auto
    </Button>
  </div>
);
