import { CircleHelp } from '../icons';
import { Chip } from './Chip';

type Props = {
  readonly count: number;
  readonly className?: string;
};

export const NeedsYouChip = ({ count, className }: Props) => (
  <Chip
    tone="neutral"
    size="control"
    emphasis="subtle"
    icon={<CircleHelp size={12} />}
    label={`${count} ${count === 1 ? 'needs' : 'need'} you`}
    className={className}
  />
);
