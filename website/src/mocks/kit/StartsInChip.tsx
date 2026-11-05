import { FolderTree } from '../icons';
import { Chip } from './Chip';

type Props = {
  readonly target: string;
  readonly verb?: string;
  readonly className?: string;
};

export const StartsInChip = ({ target, verb = 'Starts in', className }: Props) => (
  <Chip
    tone="neutral"
    size="xs"
    bordered={false}
    icon={<FolderTree size={12} />}
    label={
      <>
        <span className="gkMuted">{verb}</span> <span className="gkFg">{target}</span>
      </>
    }
    className={className}
  />
);
