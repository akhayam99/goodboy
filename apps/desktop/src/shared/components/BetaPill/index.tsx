import { Chip } from '@goodboy/ui';

type Props = {
  readonly className?: string;
};

export const BetaPill = ({ className }: Props) => {
  return <Chip tone="primary" label="Beta" className={className} />;
};
