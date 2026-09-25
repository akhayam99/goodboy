import { useState } from 'react';
import { Button, Input, Textarea } from '@goodboy/ui';
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
        className="h-7 text-sm font-semibold"
      />
      <Textarea
        value={goal}
        onChange={(event) => setGoal(event.target.value)}
        autoGrow
        minRows={3}
        maxRows={12}
        aria-label="Brief goal"
        className="text-xs leading-relaxed"
      />
      <footer className="flex items-center justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!canSave}
          onClick={() => onSave({ title: title.trim(), goal: goal.trim() })}
        >
          Save
        </Button>
      </footer>
    </>
  );
};
