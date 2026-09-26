import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { GoodboyIgnoreMode, WorkspaceId } from '@goodboy/types';
import { Button, Notice, formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { GOODBOY_IGNORE_CHOICES } from '../goodboyIgnoreChoices';

type Props = {
  readonly workspaceId: WorkspaceId;
};

type ApplyMode = Exclude<GoodboyIgnoreMode, 'existing'>;

export const GoodboyIgnoreCard = ({ workspaceId }: Props) => {
  const pendingProjects = useAppStore(
    useShallow((state) =>
      state.projects.filter(
        (project) =>
          project.workspaceId === workspaceId &&
          project.kind === 'repo' &&
          project.disconnectedAt === undefined &&
          project.goodboyIgnoreCheckedAt !== undefined &&
          project.goodboyIgnore === undefined,
      ),
    ),
  );
  const saveGoodboyIgnore = useAppStore((state) => state.saveGoodboyIgnore);
  const [mode, setMode] = useState<ApplyMode>('this-mac');
  const [isDismissed, setIsDismissed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pendingProjects.length === 0 || isDismissed) {
    return null;
  }

  const onSaveAll = async () => {
    setIsSaving(true);
    setError(null);
    try {
      for (const project of pendingProjects) {
        await saveGoodboyIgnore({ projectId: project.id, mode });
      }
      setIsDismissed(true);
    } catch (failure) {
      setError(formatError(failure));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Notice
      tone="info"
      placement="banner"
      title={`Git doesn't ignore .goodboy in ${pendingProjects.length} projects`}
      body="Goodboy keeps worktrees and attachments in a .goodboy folder inside each project. Right now it hides it on this Mac only."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsDismissed(true)}
            disabled={isSaving}
          >
            Choose per project
          </Button>
          <Button variant="primary" size="sm" onClick={() => void onSaveAll()} isBusy={isSaving}>
            {`Save for ${pendingProjects.length} projects`}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-1.5">
        {GOODBOY_IGNORE_CHOICES.map((choice) => (
          <label key={choice.mode} className="flex items-start gap-2 text-xs">
            <input
              type="radio"
              name="goodboy-ignore-mode"
              checked={mode === choice.mode}
              onChange={() => setMode(choice.mode)}
              className="mt-0.5"
            />
            <span className="flex flex-col">
              <span className="font-medium text-foreground">{choice.label}</span>
              <span className="text-faint-foreground">{choice.hint}</span>
            </span>
          </label>
        ))}
        {error !== null && (
          <p role="alert" className="text-2xs text-danger">
            {error}
          </p>
        )}
      </div>
    </Notice>
  );
};
