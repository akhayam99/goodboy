import { useState } from 'react';
import { Button, FormActions, Input } from '@goodboy/ui';
import { PromptField } from '../../../../../shared/components/PromptField';
import type { IssueBriefSource } from '../../../../../store/slices/issue-briefs/types';
import { BriefHeader } from './BriefHeader';

type SaveParams = {
  readonly title: string;
  readonly goal: string;
};

type Props = {
  readonly source: IssueBriefSource;
  readonly initialTitle: string;
  readonly initialGoal: string;
  readonly onSave: (params: SaveParams) => void;
  readonly onCancel: () => void;
};

export const BriefEditor = ({ source, initialTitle, initialGoal, onSave, onCancel }: Props) => {
  const [title, setTitle] = useState(initialTitle);
  const [goal, setGoal] = useState(initialGoal);
  const canSave = title.trim() !== '' && goal.trim() !== '';

  return (
    <>
      <BriefHeader source={source} label={`Brief from ${source.identifier}`} trailing={null} />
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        aria-label="Brief title"
        className="h-7 text-heading"
      />
      <PromptField
        kind="document"
        value={goal}
        onChange={setGoal}
        onSubmit={() => onSave({ title: title.trim(), goal: goal.trim() })}
        isSubmitBlocked={!canSave}
        hasPreview
        minRows={3}
        maxRows={12}
        label="Brief goal"
        textClassName="text-xs leading-relaxed"
      />
      <FormActions>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!canSave}
          onClick={() => onSave({ title: title.trim(), goal: goal.trim() })}
        >
          Save
        </Button>
      </FormActions>
    </>
  );
};
