import { useState } from 'react';
import { Input } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { reminderDraftOf } from '../../reminderDraftOf';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly now: number;
};

const PLACEHOLDER = 'Add a reminder, e.g. ping Teo at 17:00';

export const ReminderInput = ({ workspaceId, now }: Props) => {
  const [text, setText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const addReminder = useAppStore((state) => state.addReminder);

  const submit = async (): Promise<void> => {
    if (text.trim() === '' || isSaving) {
      return;
    }
    const draft = reminderDraftOf({ text, now: Math.max(now, Date.now()) });
    setIsSaving(true);
    const result = await addReminder({
      workspaceId,
      text: draft.text,
      trigger: 'time',
      dueAt: draft.dueAt,
      target: null,
    });
    setIsSaving(false);
    if (result.isOk) {
      setText('');
    }
  };

  return (
    <Input
      size="sm"
      aria-label="Add a reminder"
      placeholder={PLACEHOLDER}
      value={text}
      disabled={isSaving}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
          return;
        }
        event.preventDefault();
        void submit();
      }}
    />
  );
};
