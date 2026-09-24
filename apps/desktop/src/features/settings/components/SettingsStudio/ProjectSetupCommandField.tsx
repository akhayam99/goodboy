import { useState } from 'react';
import type { Project } from '@goodboy/types';
import { Button, Input, SegmentedTabs, formatError, type SegmentedTabOption } from '@goodboy/ui';
import { useAppStore } from '../../../../store';

type Props = {
  readonly project: Project;
};

type SetupMode = 'unset' | 'command' | 'none';

const MODE_OPTIONS: ReadonlyArray<SegmentedTabOption<SetupMode>> = [
  { value: 'unset', label: 'Not set' },
  { value: 'command', label: 'Command' },
  { value: 'none', label: 'Nothing to install' },
];

type ProjectParams = {
  readonly project: Project;
};

type PersistParams = {
  readonly mode: SetupMode;
  readonly command: string;
};

const modeOf = ({ project }: ProjectParams): SetupMode => project.setup?.kind ?? 'unset';

const commandOf = ({ project }: ProjectParams): string =>
  project.setup?.kind === 'command' ? project.setup.command : '';

export const ProjectSetupCommandField = ({ project }: Props) => {
  const updateProjectSetup = useAppStore((state) => state.updateProjectSetup);
  const [mode, setMode] = useState<SetupMode>(modeOf({ project }));
  const [draft, setDraft] = useState(commandOf({ project }));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const stored = commandOf({ project });
  const trimmed = draft.trim();
  const canSaveCommand =
    trimmed.length > 0 && (trimmed !== stored || modeOf({ project }) !== 'command');

  const persist = async ({ mode: nextMode, command }: PersistParams) => {
    setError(null);
    setIsSaving(true);
    try {
      switch (nextMode) {
        case 'unset': {
          await updateProjectSetup({ projectId: project.id, setup: { kind: 'unset' } });
          return;
        }
        case 'none': {
          await updateProjectSetup({ projectId: project.id, setup: { kind: 'none' } });
          return;
        }
        case 'command': {
          await updateProjectSetup({ projectId: project.id, setup: { kind: 'command', command } });
          return;
        }
        default: {
          const exhaustive: never = nextMode;
          return exhaustive;
        }
      }
    } catch (failure) {
      setError(formatError(failure));
    } finally {
      setIsSaving(false);
    }
  };

  const choose = (next: SetupMode) => {
    setMode(next);
    if (next === 'command' || next === modeOf({ project })) {
      return;
    }
    void persist({ mode: next, command: '' });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-2xs text-muted-foreground">Private checkout setup</span>
        <SegmentedTabs
          ariaLabel={`Setup for private checkouts of ${project.name}`}
          size="sm"
          options={MODE_OPTIONS}
          value={mode}
          onChange={choose}
        />
        {project.setup !== undefined ? (
          <span className="text-2xs text-faint-foreground">revision {project.setup.revision}</span>
        ) : null}
      </div>
      {mode === 'command' ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSaveCommand) {
              return;
            }
            void persist({ mode: 'command', command: trimmed });
          }}
        >
          <Input
            aria-label={`Setup command for ${project.name}`}
            value={draft}
            disabled={isSaving}
            placeholder="command that installs dependencies in a fresh checkout"
            onChange={(event) => setDraft(event.target.value)}
            className="h-7 font-mono text-xs"
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={isSaving || !canSaveCommand}
          >
            Save
          </Button>
        </form>
      ) : null}
      <span className="text-2xs text-muted-foreground">
        Runs in every new private checkout before a scoped cluster starts there. While it is not
        set, clusters run one at a time.
      </span>
      {error !== null ? (
        <span role="alert" className="text-2xs text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
};
