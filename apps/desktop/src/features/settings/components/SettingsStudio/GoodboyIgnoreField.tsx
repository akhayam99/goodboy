import { useEffect, useState } from 'react';
import type { GoodboyIgnoreMode, Project } from '@goodboy/types';
import { Button, formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { GOODBOY_IGNORE_CHOICES } from '../../../workspace/components/goodboyIgnoreChoices';

type Props = {
  readonly project: Project;
};

type ApplyMode = Exclude<GoodboyIgnoreMode, 'existing'>;

const SOURCE_LABEL: Readonly<Record<string, string>> = {
  global: 'Ignored by your global git ignore',
  gitignore: 'Ignored by .gitignore',
  'info-exclude': 'Hidden on this Mac only',
};

const statusLabel = ({ project }: { readonly project: Project }): string | null => {
  if (project.goodboyIgnore === undefined) {
    return project.goodboyIgnoreCheckedAt === undefined ? null : 'Not ignored';
  }
  if (project.goodboyIgnore === 'this-mac') {
    return 'Hidden on this Mac only';
  }
  if (project.goodboyIgnore === 'project') {
    return "Added to the project's .gitignore";
  }
  if (project.goodboyIgnore === 'global') {
    return 'Ignored in your global git ignore';
  }
  return SOURCE_LABEL[project.goodboyIgnoreSource ?? ''] ?? 'Ignored';
};

export const GoodboyIgnoreField = ({ project }: Props) => {
  const checkGoodboyIgnore = useAppStore((state) => state.checkGoodboyIgnore);
  const saveGoodboyIgnore = useAppStore((state) => state.saveGoodboyIgnore);
  const [isChanging, setIsChanging] = useState(false);
  const [mode, setMode] = useState<ApplyMode>('this-mac');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (project.goodboyIgnoreCheckedAt === undefined) {
      void checkGoodboyIgnore({ projectId: project.id });
    }
  }, [checkGoodboyIgnore, project.goodboyIgnoreCheckedAt, project.id]);

  if (project.kind !== 'repo') {
    return null;
  }

  const label = statusLabel({ project });

  const onSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await saveGoodboyIgnore({ projectId: project.id, mode });
      setIsChanging(false);
    } catch (failure) {
      setError(formatError(failure));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isChanging) {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-2xs text-faint-foreground">
        {label !== null && <span>{label}</span>}
        <button
          type="button"
          onClick={() => setIsChanging(true)}
          className="text-faint-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Change
        </button>
      </span>
    );
  }

  return (
    <span className="flex flex-col items-end gap-1.5">
      <div className="flex flex-col gap-1">
        {GOODBOY_IGNORE_CHOICES.map((choice) => (
          <label key={choice.mode} className="flex items-center gap-1.5 text-2xs">
            <input
              type="radio"
              name={`goodboy-ignore-mode-${project.id}`}
              checked={mode === choice.mode}
              onChange={() => setMode(choice.mode)}
            />
            {choice.label}
          </label>
        ))}
      </div>
      <span className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={() => setIsChanging(false)} disabled={isSaving}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={() => void onSave()} isBusy={isSaving}>
          Save
        </Button>
      </span>
      {error !== null && (
        <span role="alert" className="text-2xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
};
