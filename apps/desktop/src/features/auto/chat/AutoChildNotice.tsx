import { Button } from '@goodboy/ui';

type Props = {
  readonly onOpenAuto: () => void;
};

export const AutoChildNotice = ({ onOpenAuto }: Props) => (
  <div className="flex min-w-0 items-center gap-3 text-ui text-muted-foreground">
    <p className="min-w-0 flex-1">Started by Auto. Auto sees what you tell it.</p>
    <Button variant="quiet" size="xs" onClick={onOpenAuto}>
      Open Auto
    </Button>
  </div>
);
