import { AlertTriangle } from 'lucide-react';
import { Button, Input, Textarea } from '@goodboy/ui';
import type { Project, ProjectId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ProjectSelect } from './ProjectSelect';

type Props = {
  readonly label: string;
  readonly name: string;
  readonly body: string;
  readonly projects: ReadonlyArray<Project>;
  readonly projectId: ProjectId;
  readonly error: string | null;
  readonly isSaving: boolean;
  readonly onNameChange: (value: string) => void;
  readonly onBodyChange: (value: string) => void;
  readonly onProjectChange: (projectId: ProjectId) => void;
  readonly onSave: () => void;
  readonly onCancel: () => void;
};

export const ScriptEditor = ({
  label,
  name,
  body,
  projects,
  projectId,
  error,
  isSaving,
  onNameChange,
  onBodyChange,
  onProjectChange,
  onSave,
  onCancel,
}: Props) => {
  const projectName = projects.find((project) => project.id === projectId)?.name ?? 'this project';

  return (
    <section
      aria-label={label}
      className="flex flex-col gap-2 rounded-md border border-border-soft bg-subtle p-3"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
          return;
        }
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          onSave();
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Script name"
          aria-label="Script name"
          autoFocus
          className="min-w-0 flex-1"
        />
        {projects.length > 1 ? (
          <ProjectSelect
            projects={projects}
            projectId={projectId}
            ariaLabel="Script project"
            onChange={onProjectChange}
          />
        ) : (
          <span className="shrink-0 text-label text-muted-foreground">{projectName}</span>
        )}
      </div>
      <Textarea
        value={body}
        onChange={(event) => onBodyChange(event.target.value)}
        aria-label="Script body"
        placeholder={'#!/usr/bin/env bash\nset -euo pipefail\npnpm test'}
        className="w-full text-code"
        autoGrow
        minRows={4}
        maxRows={24}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />
      <footer className="flex flex-wrap items-center gap-2">
        {error === null ? (
          <p className="min-w-0 flex-1 text-secondary text-faint-foreground">
            Saved scripts run in any branch of {projectName}, in every session of this workspace.
          </p>
        ) : (
          <p role="alert" className="flex min-w-0 flex-1 items-center gap-1 text-label text-danger">
            <AlertTriangle size={ICON_SIZE.row} aria-hidden />
            {error}
          </p>
        )}
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} isBusy={isSaving}>
          Save
        </Button>
      </footer>
    </section>
  );
};
