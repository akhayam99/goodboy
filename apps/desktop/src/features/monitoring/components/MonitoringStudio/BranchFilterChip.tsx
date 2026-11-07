import { X } from 'lucide-react';
import { Chip, ICON_SIZE } from '@goodboy/ui';
import { useAppStore } from '../../../../store';

type Props = {
  readonly branch: string;
};

export const BranchFilterChip = ({ branch }: Props) => {
  const amendStudio = useAppStore((state) => state.amendStudio);

  return (
    <div className="flex items-center gap-2 text-meta text-muted-foreground">
      <span>Showing</span>
      <Chip
        as="button"
        kind="reference"
        tone="neutral"
        label={branch}
        trailing={<X size={ICON_SIZE.row} aria-hidden />}
        ariaLabel={`Show every port, not only ${branch}`}
        onClick={() => amendStudio({ studio: { kind: 'monitoring', branch: null } })}
      />
    </div>
  );
};
