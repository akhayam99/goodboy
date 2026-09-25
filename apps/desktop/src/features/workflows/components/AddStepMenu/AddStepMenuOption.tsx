import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly id: string;
  readonly isActive: boolean;
  readonly lead: ReactNode;
  readonly name: string;
  readonly note: string;
  readonly trail?: ReactNode;
  readonly onHover: () => void;
  readonly onPick: () => void;
};

export const AddStepMenuOption = ({
  id,
  isActive,
  lead,
  name,
  note,
  trail = null,
  onHover,
  onPick,
}: Props) => (
  <li
    id={id}
    role="option"
    aria-selected={isActive}
    onMouseMove={onHover}
    onMouseDown={(event) => event.preventDefault()}
    onClick={onPick}
    className={cn(
      'flex h-7 min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 text-xs',
      isActive ? 'bg-hover text-foreground' : 'text-muted-foreground',
    )}
  >
    <span className="flex shrink-0 items-center">{lead}</span>
    <span className="shrink-0 truncate text-foreground">{name}</span>
    <span className="min-w-0 flex-1 truncate text-2xs text-faint-foreground">{note}</span>
    {trail}
  </li>
);
