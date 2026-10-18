import { FOCUS_RING, cn } from '@goodboy/ui';
import { portListText } from '../../portListText';

type Props = {
  readonly count: number;
  readonly freePorts: ReadonlyArray<number>;
  readonly isFreeOpen: boolean;
  readonly onToggleFree: () => void;
};

const PORTS_SHOWN = 6;

export const PortGroupMeta = ({ count, freePorts, isFreeOpen, onToggleFree }: Props) => {
  const hasFree = freePorts.length > 0;
  const hasCount = count > 1 || (count > 0 && hasFree);
  if (!hasCount && !hasFree) {
    return null;
  }
  const freeText = `${freePorts.length} free`;

  return (
    <span className="flex items-center gap-1 text-meta tabular-nums text-faint-foreground">
      {hasCount ? <span>{count}</span> : null}
      {hasCount && hasFree ? <span aria-hidden>·</span> : null}
      {hasFree ? (
        <button
          type="button"
          aria-expanded={isFreeOpen}
          aria-label={`${freeText}: ${portListText({ ports: freePorts, max: PORTS_SHOWN })}`}
          onClick={onToggleFree}
          className={cn(
            'cursor-pointer rounded-sm motion-safe:transition-colors hover:text-foreground',
            FOCUS_RING,
          )}
        >
          {freeText}
        </button>
      ) : null}
    </span>
  );
};
