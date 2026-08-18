import { useMemo } from 'react';
import { SkeletonText } from '@goodboy/ui';
import {
  insertSummarySection,
  parseSummaryDocument,
  replaceSummarySectionBody,
} from '@goodboy/core';
import { RawDocumentEditor } from './RawDocumentEditor';
import { SummaryBlock } from './SummaryBlock';
import { summaryDisplayBlocks } from './summaryDisplayBlocks';

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
    <div className="flex flex-col gap-4">
      {blocks.map((block) => (
        <SummaryBlock
          key={block.id}
          title={block.title}
          body={block.body}
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
