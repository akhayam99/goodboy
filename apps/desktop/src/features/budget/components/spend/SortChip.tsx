import { Chip } from '@goodboy/ui';

type Props = {
  readonly active: boolean;
  readonly label: string;
  readonly onClick: () => void;
};

export const SortChip = ({ active, label, onClick }: Props) => (
  <Chip
    as="button"
    tone={active ? 'primary' : 'neutral'}
    size="xs"
    shape="badge"
    emphasis={active ? 'strong' : 'soft'}
    label={label}
    onClick={onClick}
    className="uppercase tracking-[0.08em]"
  />
);
