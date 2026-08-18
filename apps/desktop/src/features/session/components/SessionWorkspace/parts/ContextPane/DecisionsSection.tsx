import { useMemo } from 'react';
import { appendDecision, parseDecisions, removeDecision, replaceDecision } from '@goodboy/core';
import { CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
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
    return (
      <div className="flex flex-col gap-2" aria-label="Loading decisions">
        <div className="h-4 w-full rounded bg-muted/50" />
        <div className="h-4 w-3/4 rounded bg-muted/50" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {document.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No decisions yet</p>
      ) : null}
      {document.rows.map((row, position) => (
        <DecisionRowItem
          key={row.index}
          text={row.text}
          position={position + 1}
          tone={CONCEPT_TONE.decisions}
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
        <p className="text-2xs leading-relaxed text-muted-foreground">
          This document also holds text that no row covers. Edit the source to reach it.
        </p>
      ) : null}
    </div>
  );
};
