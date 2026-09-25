import { orderRecordSections } from './orderRecordSections';
import { RecordSectionBlock } from './RecordSectionBlock';
import type { RecordSection } from './types';

type Props = {
  readonly sections: ReadonlyArray<RecordSection>;
};

export const RecordSections = ({ sections }: Props) => (
  <div data-slot="record-sections" className="flex min-w-0 flex-col gap-5">
    {orderRecordSections({ sections }).map((section) => (
      <RecordSectionBlock key={section.key} section={section} />
    ))}
  </div>
);
