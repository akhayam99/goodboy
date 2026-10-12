import { Button } from '@goodboy/ui';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { useAppStore } from '../../../../store';

type Props = {
  readonly count: number;
};

const KEY = 'show-hidden-ports';

export const HiddenFooter = ({ count }: Props) => {
  const showHiddenPorts = useAppStore((state) => state.showHiddenPorts);
  const pending = usePendingAction();

  return (
    <div className="flex items-center gap-1 px-2 text-meta text-faint-foreground">
      <span>{count} hidden</span>
      <span aria-hidden>·</span>
      <Button
        size="xs"
        variant="ghost"
        aria-label="Show hidden ports"
        disabled={pending.pendingKeys.has(KEY)}
        onClick={() =>
          void pending.run({
            key: KEY,
            failureTitle: "Couldn't show the ports",
            task: () => showHiddenPorts(),
          })
        }
      >
        Show
      </Button>
    </div>
  );
};
