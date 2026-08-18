import { useState } from 'react';
import { BlockEditor } from './BlockEditor';

type Props = {
  readonly value: string;
  readonly label: string;
  readonly onWrite: (next: string) => void;
  readonly onClose: () => void;
};

export const RawDocumentEditor = ({ value, label, onWrite, onClose }: Props) => {
  const [draft, setDraft] = useState(value);

  return (
    <BlockEditor
      value={draft}
      label={label}
      minRows={12}
      onChange={setDraft}
      onCommit={() => {
        onClose();
        if (draft !== value) {
          onWrite(draft);
        }
      }}
      onCancel={onClose}
    />
  );
};
