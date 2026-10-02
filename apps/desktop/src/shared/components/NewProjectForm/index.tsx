import { useId, type FormEvent } from 'react';
import { Button, Eyebrow, Input, Notice } from '@goodboy/ui';
import { useNewProject } from '../../hooks/useNewProject';

type Props = {
  readonly onCreated?: () => void;
  readonly onCancel?: () => void;
  readonly autoFocus?: boolean;
};

const STEPS: ReadonlyArray<string> = [
  'Creates the project folder',
  'Starts a git repository on main',
  'Makes a first commit with a .gitignore and nothing else',
  'Opens a first session that works in that folder',
];

export const NewProjectForm = ({ onCreated, onCancel, autoFocus = true }: Props) => {
  const model = useNewProject({ onCreated });
  const nameId = useId();
  const problemId = useId();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void model.submit();
  };

  return (
    <form
      aria-label="Start a new project"
      onSubmit={onSubmit}
      className="flex w-full flex-col gap-5 text-left"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={nameId} className="text-label text-foreground">
          Project name
        </label>
        <Input
          id={nameId}
          value={model.name}
          disabled={model.busy}
          autoFocus={autoFocus}
          placeholder="cascadia"
          aria-invalid={model.nameProblem !== null}
          aria-describedby={model.nameProblem === null ? undefined : problemId}
          onChange={(event) => model.setName(event.target.value)}
        />
        {model.nameProblem !== null ? (
          <p id={problemId} className="text-secondary text-danger">
            {model.nameProblem}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-label text-foreground">Location</span>
        <div className="flex items-center gap-2">
          <span
            className="min-w-0 flex-1 truncate font-mono text-secondary text-muted-foreground"
            title={model.folderPreview ?? undefined}
          >
            {model.folderPreview ?? 'Choose where the folder goes'}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={model.busy}
            onClick={() => void model.changeParent()}
          >
            Change
          </Button>
        </div>
      </div>

      <section aria-label="What happens" className="flex flex-col gap-1.5">
        <Eyebrow label="What happens" muted />
        <ul className="flex flex-col gap-1 text-secondary text-muted-foreground">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </section>

      {model.error !== null ? (
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title={model.error}
          actions={
            model.existingPath === null ? undefined : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={model.busy}
                onClick={() => void model.openExisting()}
              >
                Open it instead
              </Button>
            )
          }
        />
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={!model.canSubmit} aria-busy={model.busy}>
          Create project
        </Button>
        {onCancel === undefined ? null : (
          <Button type="button" variant="ghost" disabled={model.busy} onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
};
