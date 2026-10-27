import { Button } from '@goodboy/ui';

type Props = {
  readonly count: number;
  readonly onClear: () => void;
};

export const NeedsYouElsewhere = ({ count, onClear }: Props) => {
  if (count <= 0) {
    return null;
  }
  return (
    <Button
      variant="ghost"
      size="xs"
      data-needs-you-elsewhere=""
      onClick={onClear}
    >{`${count} more ${count === 1 ? 'needs' : 'need'} you in other projects`}</Button>
  );
};
