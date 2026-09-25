import type { RecordSection, RecordSectionKind } from './types';

const KIND_RANK = {
  description: 0,
  tool: 1,
  conversation: 2,
} satisfies Record<RecordSectionKind, number>;

type Params = {
  readonly sections: ReadonlyArray<RecordSection>;
};

export const orderRecordSections = ({ sections }: Params): ReadonlyArray<RecordSection> =>
  sections
    .map((section, index) => ({ section, index }))
    .sort(
      (left, right) =>
        KIND_RANK[left.section.kind] - KIND_RANK[right.section.kind] || left.index - right.index,
    )
    .map(({ section }) => section);
