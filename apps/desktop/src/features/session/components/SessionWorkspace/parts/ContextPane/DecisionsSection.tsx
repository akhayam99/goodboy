import { useMemo } from 'react';
import { SkeletonText } from '@goodboy/ui';
import { appendDecision, parseDecisions, removeDecision, replaceDecision } from '@goodboy/core';
import { AddDecisionRow } from './AddDecisionRow';
import { DecisionRowItem } from './DecisionRowItem';
import { RawDocumentEditor } from './RawDocumentEditor';

type Props = {
  readonly value: string;
  readonly isLoading: boolean;
  readonly isLocked: boolean;
  readonly isRawEditing: boolean;
  readonly onWrite: (next: string) => void;
  readonly onCloseRawEditor: () => void;
};

export const DecisionsSection = ({
  value,
  isLoading,
  isLocked,
  isRawEditing,
  onWrite,
  onCloseRawEditor,
}: Props) => {
  const document = useMemo(() => parseDecisions({ text: value }), [value]);

  if (isRawEditing) {
    return (
      <RawDocumentEditor
        value={value}
        label="Decisions source"
        onWrite={onWrite}
        onClose={onCloseRawEditor}
      />
    );
  }

  if (isLoading) {
    return <SkeletonText lines={2} />;
  }

  return (
    <div className="flex flex-col gap-2">
      {document.rows.map((row, position) => (
        <DecisionRowItem
          key={row.index}
          text={row.text}
          position={position + 1}
          isLocked={isLocked}
          onCommit={(decision) =>
            onWrite(replaceDecision({ text: value, index: row.index, decision }))
          }
          onDelete={() => onWrite(removeDecision({ text: value, index: row.index }))}
        />
      ))}
      <AddDecisionRow
        isLocked={isLocked}
        onAdd={(decision) => onWrite(appendDecision({ text: value, decision }))}
      />
      {document.hasContentOutsideRows ? (
        <p className="text-2xs text-muted-foreground">
          This document also holds text that no row covers. Edit the source to reach it.
        </p>
      ) : null}
    </div>
  );
};
