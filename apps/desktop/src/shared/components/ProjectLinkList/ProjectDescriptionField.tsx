import { useState, type KeyboardEvent } from 'react';
import type { Project } from '@goodboy/types';
import { useAppStore } from '../../../store';

type Props = {
  readonly project: Project;
  readonly busy: boolean;
};

const DESCRIPTION_MAX_LENGTH = 120;
const COUNTER_THRESHOLD = 20;
const SAVED_FEEDBACK_MS = 1500;

export const ProjectDescriptionField = ({ project, busy }: Props) => {
  const describeProject = useAppStore((state) => state.describeProject);
  const reportError = useAppStore((state) => state.reportError);
  const description = project.description ?? '';
  const [draft, setDraft] = useState(description);
  const [showSaved, setShowSaved] = useState(false);
  const remaining = DESCRIPTION_MAX_LENGTH - draft.length;
  const label = `Description of ${project.name}`;

  const save = async () => {
    const trimmed = draft.trim();
    setDraft(trimmed);
    if (trimmed === description) {
      return;
    }
    try {
      await describeProject({ projectId: project.id, description: trimmed });
      setShowSaved(true);
      window.setTimeout(() => setShowSaved(false), SAVED_FEEDBACK_MS);
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
      setDraft(description);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <input
        type="text"
        value={draft}
        aria-label={label}
        maxLength={DESCRIPTION_MAX_LENGTH}
        placeholder="Add a one-line description"
        disabled={busy}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={onKeyDown}
        className="h-8 min-w-0 rounded-md border border-border-soft bg-background px-2 text-row text-foreground outline-none placeholder:text-faint-foreground focus:border-border"
      />
      <div className="flex items-center gap-2 text-label text-faint-foreground">
        <span className="flex-1">Every agent reads this next to the project name.</span>
        {showSaved ? <span className="text-success">Saved</span> : null}
        {remaining <= COUNTER_THRESHOLD ? <span>{remaining}</span> : null}
      </div>
    </div>
  );
};
