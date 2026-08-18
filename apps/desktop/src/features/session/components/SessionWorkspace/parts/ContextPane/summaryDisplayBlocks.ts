import {
  SUMMARY_SECTION_KEYS,
  SUMMARY_SECTION_TITLES,
  type SummaryDocument,
  type SummarySectionKey,
} from '@goodboy/core';

const SUMMARY_NOTES_TITLE = 'Notes';

export type SummaryDisplayBlock = {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly index: number | null;
  readonly sectionKey: SummarySectionKey | null;
};

type Params = {
  readonly document: SummaryDocument;
};

export const summaryDisplayBlocks = ({ document }: Params): ReadonlyArray<SummaryDisplayBlock> => {
  const notes = document.blocks
    .filter((block) => block.headingLine == null)
    .map((block) => ({
      id: `notes-${block.index}`,
      title: SUMMARY_NOTES_TITLE,
      body: block.body ?? '',
      index: block.index,
      sectionKey: null,
    }));

  const hasKnownSection = document.blocks.some((block) => block.sectionKey != null);
  const isBlankDocument = document.blocks.length === 0;
  const offersEverySection = hasKnownSection || isBlankDocument;

  const sections = SUMMARY_SECTION_KEYS.flatMap<SummaryDisplayBlock>((sectionKey) => {
    const block = document.blocks.find((candidate) => candidate.sectionKey === sectionKey);
    if (block != null) {
      return [
        {
          id: `section-${sectionKey}`,
          title: block.title,
          body: block.body ?? '',
          index: block.index,
          sectionKey,
        },
      ];
    }
    if (offersEverySection === false) {
      return [];
    }
    return [
      {
        id: `section-${sectionKey}`,
        title: SUMMARY_SECTION_TITLES[sectionKey],
        body: '',
        index: null,
        sectionKey,
      },
    ];
  });

  const extras = document.blocks
    .filter((block) => block.headingLine != null && block.sectionKey == null)
    .map((block) => ({
      id: `extra-${block.index}`,
      title: block.title,
      body: block.body ?? '',
      index: block.index,
      sectionKey: null,
    }));

  return [...notes, ...sections, ...extras];
};
