import { FolderGit2, FolderPlus, Layers } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button, Input, cn } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import type { DetectedChildRepos } from '../../../../shared/hooks/useChildRepoDetection';
import { DetectedRepoList } from '../../../../shared/components/DetectedRepoList';

export type WorkspaceShape = 'workspace' | 'single';

type SingleProjectPick = {
  readonly path: string;
  readonly initialize: boolean;
};

type Props = {
  readonly workspace: Workspace | null;
  readonly shape: WorkspaceShape | null;
  readonly onShapeChange: (shape: WorkspaceShape) => void;
  readonly name: string;
  readonly onNameChange: (name: string) => void;
  readonly busy: boolean;
  readonly onSingleProject: (pick: SingleProjectPick) => void;
  readonly detection: DetectedChildRepos | null;
  readonly onConfirmDetection: (params: { readonly paths: ReadonlyArray<string> }) => void;
  readonly onDismissDetection: () => void;
};

const SHAPE_OPTIONS = [
  {
    value: 'workspace',
    icon: Layers,
    label: 'A workspace with several projects',
    hint: 'Name it after your company or team, then link the repositories that belong there.',
  },
  {
    value: 'single',
    icon: FolderGit2,
    label: 'A single project',
    hint: 'Point at one git repository. The workspace is created for you, named after the folder.',
  },
] as const;

export const ShapeStep = ({
  workspace,
  shape,
  onShapeChange,
  name,
  onNameChange,
  busy,
  onSingleProject,
  detection,
  onConfirmDetection,
  onDismissDetection,
}: Props) => {
  const pickFolder = async (initialize: boolean) => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked === 'string' && picked.length > 0) {
      onSingleProject({ path: picked, initialize });
    }
  };

  if (workspace !== null) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 text-primary">
          <FolderGit2 size={26} aria-hidden />
        </span>

        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Your workspace</h2>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
            A workspace groups the projects, sessions, and connections of one product or team.
          </p>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-1.5 text-left">
          <label
            htmlFor="onboarding-workspace-name"
            className="text-xs font-medium text-foreground"
          >
            Workspace name
          </label>
          <Input
            id="onboarding-workspace-name"
            value={name}
            autoFocus
            placeholder="Your company or team name"
            onChange={(event) => onNameChange(event.target.value)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 text-primary">
        <FolderGit2 size={26} aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          What are you setting up?
        </h2>
      </div>

      <div className="flex w-full flex-col gap-5 text-left">
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Setup shape">
          {SHAPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={shape === option.value}
              disabled={busy}
              onClick={() => onShapeChange(option.value)}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-3 py-3 text-left motion-safe:transition-colors',
                shape === option.value
                  ? 'border-primary/60 bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-primary/5',
              )}
            >
              <span className="mt-0.5 shrink-0 text-primary">
                <option.icon size={16} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{option.label}</span>
                <span className="block text-xs leading-relaxed text-muted-foreground">
                  {option.hint}
                </span>
              </span>
            </button>
          ))}
        </div>

        {shape === 'workspace' ? (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="onboarding-workspace-name"
              className="text-xs font-medium text-foreground"
            >
              Workspace name
            </label>
            <Input
              id="onboarding-workspace-name"
              value={name}
              autoFocus
              placeholder="Your company or team name"
              disabled={busy}
              onChange={(event) => onNameChange(event.target.value)}
            />
          </div>
        ) : null}

        {shape === 'single' ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-foreground">Your project folder</span>
            <div className="flex items-center gap-2">
              <Button variant="primary" disabled={busy} onClick={() => void pickFolder(false)}>
                <FolderGit2 size={14} aria-hidden />
                Choose a repository
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void pickFolder(true)}>
                <FolderPlus size={14} aria-hidden />
                New project
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Pick a folder with a git repository, or let New project run git init in an empty one.
            </p>
            {detection !== null ? (
              <DetectedRepoList
                repos={detection.repos}
                busy={busy}
                onConfirm={onConfirmDetection}
                onDismiss={onDismissDetection}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
