import { AlertTriangle } from 'lucide-react';
import { Button, Divider, FieldRow, Input, Textarea } from '@goodboy/ui';
import type { Project, ProjectId } from '@goodboy/types';
import { ProjectSelect } from './ProjectSelect';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly name: string;
  readonly body: string;
  readonly projects: ReadonlyArray<Project>;
  readonly projectId: ProjectId;
  readonly error: string | null;
  readonly onNameChange: (value: string) => void;
  readonly onBodyChange: (value: string) => void;
  readonly onProjectChange: (projectId: ProjectId) => void;
  readonly onSave: () => void;
  readonly onCancel: () => void;
};

export const NewScriptCard = ({
  name,
  body,
  projects,
  projectId,
  error,
  onNameChange,
  onBodyChange,
  onProjectChange,
  onSave,
  onCancel,
}: Props) => (
  <section className="flex flex-col gap-6">
    <section className="flex flex-col">
      <FieldRow label="Name">
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Script name (e.g. copy environments)"
          autoFocus
          className="w-full sm:w-72"
        />
      </FieldRow>
      <Divider />
      {projects.length > 1 ? (
        <>
          <FieldRow label="Project">
            <ProjectSelect
              projects={projects}
              projectId={projectId}
              ariaLabel="New script project"
              onChange={onProjectChange}
            />
          </FieldRow>
          <Divider />
        </>
      ) : null}
      <FieldRow label="Command" help="Runs from this project's worktree for the session.">
        <Textarea
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
          placeholder={'#!/bin/bash\ncp ../main/.env .env'}
          className="w-full font-mono text-xs sm:w-96"
          autoGrow
          minRows={5}
          maxRows={24}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
        />
      </FieldRow>
    </section>
    <Divider />
    <footer className="flex shrink-0 items-center gap-3">
      <div className="min-w-0 flex-1">
        {error !== null ? (
          <span role="alert" className="inline-flex items-center gap-1 text-xs text-danger">
            <AlertTriangle size={ICON_SIZE.row} aria-hidden />
            {error}
          </span>
        ) : null}
      </div>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="sm" onClick={onSave}>
        Save
      </Button>
    </footer>
  </section>
);
