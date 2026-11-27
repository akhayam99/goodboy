import { Button } from '@goodboy/ui';

type Props = {
  readonly count: number;
  readonly onOpen: () => void;
};

export const MoreLink = ({ count, onOpen }: Props) => (
  <Button size="xs" variant="quiet" onClick={onOpen}>
    +{count} more
  </Button>
);
