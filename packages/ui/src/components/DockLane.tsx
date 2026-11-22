import { useContext } from 'react';
import { cn } from '../cn';
import { DockLaneContext } from '../dockLaneContext';

type Props = {
  readonly className?: string;
};

export const DockLane = ({ className }: Props) => {
  const setLane = useContext(DockLaneContext);
  return (
    <div
      ref={setLane ?? undefined}
      data-dock-lane=""
      className={cn('min-h-0 min-w-0 flex-1', className)}
    />
  );
};
