import { useMemo } from 'react';
import { Button } from '@goodboy/ui';
import {
  insertSummarySection,
  parseSummaryDocument,
  replaceSummarySectionBody,
} from '@goodboy/core';
import { CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { RawDocumentEditor } from './RawDocumentEditor';
import { SummaryBlockCard } from './SummaryBlockCard';
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
    return (
      <div className="flex flex-col gap-2" aria-label="Loading session summary">
        <div className="h-4 w-full rounded bg-muted/50" />
        <div className="h-4 w-3/4 rounded bg-muted/50" />
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="flex items-center gap-4 rounded-lg bg-subtle p-3">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">No session summary yet</p>
        <Button
          size="sm"
          variant="ghost"
          disabled={isLocked}
          onClick={() => onWrite('#### Problem\n')}
        >
          Add
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block) => (
        <SummaryBlockCard
          key={block.id}
          title={block.title}
          body={block.body}
          tone={CONCEPT_TONE.sessionSummary}
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
