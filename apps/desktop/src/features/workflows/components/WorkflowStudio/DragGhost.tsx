import { cn as tokenCn, tintClasses as tokenTintClasses } from '@goodboy/ui';
import { Plus } from 'lucide-react';

type Props = {
  readonly ghost: { label: string; x: number; y: number } | null;
};

export const DragGhost = ({ ghost }: Props) => {
  if (!ghost) {
    return null;
  }
  return (
    <div
      className={tokenCn(
        'pointer-events-none fixed z-[60] flex items-center gap-1.5 rounded-md border',
        tokenTintClasses('primary').border,
        'bg-background/95 px-2 py-1 text-2xs font-medium text-foreground shadow-lg',
      )}
      style={{ left: ghost.x + 12, top: ghost.y + 12 }}
    >
      <Plus size={11} className="text-primary" aria-hidden />
      {ghost.label}
    </div>
  );
};
