import { Button } from '@goodboy/ui';

type Props = {
  readonly count: number;
  readonly onOpen: () => void;
};

export const HistoryVersionsLink = ({ count, onOpen }: Props) => (
  <div className="flex px-2">
    <Button size="sm" variant="quiet" onClick={onOpen}>
      {`Show previous versions (${count})`}
    </Button>
  </div>
);
