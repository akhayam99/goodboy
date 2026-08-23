import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { SkeletonText } from '@goodboy/ui';
import {
  insertSummarySection,
  parseSummaryDocument,
  replaceSummarySectionBody,
  type SummarySectionKey,
} from '@goodboy/core';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { RawDocumentEditor } from './RawDocumentEditor';
import { SummaryBlock } from './SummaryBlock';
import { summaryDisplayBlocks } from './summaryDisplayBlocks';

const SECTION_ICONS: Record<SummarySectionKey, LucideIcon> = {
  problem: CONCEPT_ICONS.goal,
  learned: CONCEPT_ICONS.suggestion,
  state: CONCEPT_ICONS.autorun,
  next: CONCEPT_ICONS.nextSteps,
};

type Props = {
  readonly value: string;
  readonly isLoading: boolean;
  readonly isLocked: boolean;
  readonly isRawEditing: boolean;
  readonly onWrite: (next: string) => void;
  readonly onCloseRawEditor: () => void;
};

export const SummarySection = ({
  value,
  isLoading,
  isLocked,
  isRawEditing,
  onWrite,
  onCloseRawEditor,
}: Props) => {
  const blocks = useMemo(
    () => summaryDisplayBlocks({ document: parseSummaryDocument({ text: value }) }),
    [value],
  );

  if (isRawEditing) {
    return (
      <RawDocumentEditor
        value={value}
        label="Session summary source"
        onWrite={onWrite}
        onClose={onCloseRawEditor}
      />
    );
  }

  if (isLoading) {
    return <SkeletonText lines={3} />;
  }

  return (
    <div className="flex flex-col gap-5">
      {blocks.map((block) => (
        <SummaryBlock
          key={block.id}
          title={block.title}
          body={block.body}
          icon={block.sectionKey != null ? SECTION_ICONS[block.sectionKey] : undefined}
          isLocked={isLocked}
          onCommit={(body) => {
            if (block.index != null) {
              onWrite(replaceSummarySectionBody({ text: value, index: block.index, body }));
              return;
            }
            if (block.sectionKey != null) {
              onWrite(insertSummarySection({ text: value, sectionKey: block.sectionKey, body }));
            }
          }}
        />
      ))}
    </div>
  );
};
