import { Chip } from './Chip';
import { cx } from './cx';

type Props = {
  readonly name: string;
  readonly className?: string;
};

export const RepoChip = ({ name, className }: Props) => (
  <Chip
    tone="neutral"
    size="xs"
    bordered={false}
    label={name}
    className={cx('gkRepo', className)}
  />
);
