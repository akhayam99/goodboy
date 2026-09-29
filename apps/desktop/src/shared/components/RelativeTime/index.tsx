import { useNow } from '../../hooks/useNow';
import { formatAge } from '../../utils/time/formatAge';

type Props = {
  readonly iso: string;
  readonly title?: string;
};

export const RelativeTime = ({ iso, title }: Props) => {
  const now = useNow(30_000);
  return (
    <time dateTime={iso} title={title}>
      {formatAge({ from: iso, now })}
    </time>
  );
};
