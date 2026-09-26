import { useState, type KeyboardEvent } from 'react';
import type { Project } from '@goodboy/types';
import { FOCUS_RING, cn } from '@goodboy/ui';
import { useAppStore } from '../../../store';

type Props = {
  readonly project: Project;
  readonly busy: boolean;
};

const DESCRIPTION_MAX_LENGTH = 120;

export const ProjectDescriptionField = ({ project, busy }: Props) => {
  const describeProject = useAppStore((state) => state.describeProject);
  const reportError = useAppStore((state) => state.reportError);
  const [draft, setDraft] = useState<string | null>(null);
  const description = project.description ?? '';
  const label = `Description of ${project.name}`;

  const save = async () => {
    if (draft === null) {
      return;
    }
    setDraft(null);
    if (draft.trim() === description) {
      return;
    }
    try {
      await describeProject({ projectId: project.id, description: draft });
    } catch (error) {
      void reportError({ title: `Couldn't save the description of ${project.name}`, error });
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void save();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setDraft(null);
    }
  };

  if (draft !== null) {
    return (
      <input
        type="text"
        value={draft}
        aria-label={label}
        maxLength={DESCRIPTION_MAX_LENGTH}
        placeholder="Add a one-line description"
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={onKeyDown}
        className="h-6 min-w-0 flex-1 rounded-sm border border-border-soft bg-transparent px-1.5 text-label text-foreground outline-none placeholder:text-faint-foreground focus:border-border"
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={
        description === ''
          ? `Add a description of ${project.name}`
          : `Edit the description of ${project.name}`
      }
      disabled={busy}
      onClick={() => setDraft(description)}
      className={cn(
        'min-w-0 flex-1 truncate rounded-sm px-1 text-left text-label',
        description === ''
          ? 'text-faint-foreground hover:text-muted-foreground'
          : 'text-muted-foreground hover:text-foreground',
        FOCUS_RING,
      )}
    >
      {description === '' ? 'Add a one-line description' : description}
    </button>
  );
};
