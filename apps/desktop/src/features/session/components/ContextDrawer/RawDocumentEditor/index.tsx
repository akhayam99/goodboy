import { useEffect, useRef, useState } from 'react';
import { BlockEditor } from '../BlockEditor';

type Props = {
  readonly value: string;
  readonly label: string;
  readonly onWrite: (next: string) => Promise<boolean>;
  readonly onClose: () => void;
};

export const RawDocumentEditor = ({ value, label, onWrite, onClose }: Props) => {
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState(value);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const save = async () => {
    if (isSaving) {
      return;
    }
    if (draft === value) {
      onClose();
      return;
    }
    setIsSaving(true);
    const isSaved = await onWrite(draft);
    if (!isMounted.current) {
      return;
    }
    setIsSaving(false);
    if (isSaved) {
      onClose();
    }
  };
  return (
    <BlockEditor
      value={draft}
      label={label}
      minRows={12}
      onChange={setDraft}
      isDisabled={isSaving}
      onCommit={() => void save()}
      onCancel={onClose}
    />
  );
};
