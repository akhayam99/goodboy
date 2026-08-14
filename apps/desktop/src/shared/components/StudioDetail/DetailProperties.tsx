import type { ResolvedDetailFields } from '../../detail-fields';
import { MetaItem } from '@goodboy/ui';

type Props = {
  readonly entries: ResolvedDetailFields;
};

export const DetailProperties = ({ entries }: Props) => {
  return (
    <dl
      data-testid="detail-properties"
      className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-6 gap-y-3"
    >
      {entries.map((entry) => (
        <MetaItem key={entry.key} label={entry.label}>
          {entry.node}
        </MetaItem>
      ))}
    </dl>
  );
};
