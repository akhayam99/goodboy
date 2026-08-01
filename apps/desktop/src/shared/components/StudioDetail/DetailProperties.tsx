import type { DetailEntry } from '../../detail-fields';
import { MetaItem } from './MetaItem';

type Props = {
  readonly entries: ReadonlyArray<DetailEntry>;
};

export const DetailProperties = ({ entries }: Props) => {
  return (
    <div
      data-testid="detail-properties"
      className="flex flex-row flex-wrap gap-x-5 gap-y-3 lg:flex-col lg:flex-nowrap lg:gap-4"
    >
      {entries.map((entry) => (
        <MetaItem key={entry.key} label={entry.label}>
          {entry.node}
        </MetaItem>
      ))}
    </div>
  );
};
