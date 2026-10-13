import { cn } from '@goodboy/ui';
import { MiddleText } from '../../../../shared/components/MiddleText';
import { MIDDLE_TAIL } from '../../middleTail';

type Props = {
  readonly name: string | null;
  readonly pid: number | null;
  readonly toggleLabel?: string;
  readonly isOpen?: boolean;
  readonly onToggle?: () => void;
};

export const ProcessCell = ({ name, pid, toggleLabel, isOpen, onToggle }: Props) => {
  const content = (
    <>
      <span className="flex min-w-0 text-muted-foreground">
        {name === null || name === '' ? null : <MiddleText value={name} tail={MIDDLE_TAIL} />}
      </span>
      {pid === null ? null : (
        <span className="shrink-0 text-meta tabular-nums text-faint-foreground">{pid}</span>
      )}
    </>
  );
  if (toggleLabel === undefined || onToggle === undefined) {
    return <div className="flex min-w-0 items-center gap-1">{content}</div>;
  }
  return (
    <button
      type="button"
      aria-label={toggleLabel}
      aria-expanded={isOpen === true}
      className={cn(
        'flex min-w-0 items-center gap-1 text-left focus-visible:outline-none',
        'after:absolute after:inset-0 after:rounded-md after:content-[""]',
        'focus-visible:after:ring-2 focus-visible:after:ring-focus-ring',
      )}
      onClick={onToggle}
    >
      {content}
    </button>
  );
};
