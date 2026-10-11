import { Tooltip } from '@goodboy/ui';
import { useNow } from '../../hooks/useNow';
import { formatAge } from '../../utils/time/formatAge';

type Props = {
  readonly iso: string;
  readonly title?: string;
};

export const RelativeTime = ({ iso, title }: Props) => {
  const now = useNow(30_000);
  return (
    <Tooltip content={title}>
      <time dateTime={iso}>{formatAge({ from: iso, now })}</time>
    </Tooltip>
  );
};
