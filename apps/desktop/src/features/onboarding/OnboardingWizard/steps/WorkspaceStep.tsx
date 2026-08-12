import type { ReactNode } from 'react';
import { Check, Code2, FolderGit2, RefreshCw } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { Workspace, WorkspaceKind } from '@goodboy/types';
import type { WorkspaceLinkMode } from '../../../workspace/components/WorkspaceLinkForm';
import { WorkspaceLinkForm } from '../../../workspace/components/WorkspaceLinkForm';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

export type WorkspaceAudience = 'developer' | 'everyone-else';

type Props = {
  readonly workspace: Workspace | null;
  readonly audience: WorkspaceAudience | null;
  readonly onAudienceChange: (audience: WorkspaceAudience | null) => void;
  readonly isChanging: boolean;
  readonly onIsChangingChange: (isChanging: boolean) => void;
};

const WORKSPACE_KIND_LABELS: Record<WorkspaceKind, string> = {
  repo: 'Repository',
  composite: 'Composite',
  simple: 'Standalone',
};

const AUDIENCE_MODES: Record<WorkspaceAudience, ReadonlyArray<WorkspaceLinkMode>> = {
  developer: ['single', 'multi', 'simple'],
  'everyone-else': ['simple'],
};

const AUDIENCE_OPTIONS = [
  {
    value: 'developer',
    icon: Code2,
    label: 'I write code',
    hint: 'Connect a project folder, or link several repositories into one workspace.',
  },
  {
    value: 'everyone-else',
    icon: CONCEPT_ICONS.agents,
    label: 'I do not write code',
    hint: 'Start a workspace for agents, workflows, and shared context. No repository needed.',
  },
] as const;

export const WorkspaceStep = ({
  workspace,
  audience,
  onAudienceChange,
  isChanging,
  onIsChangingChange,
}: Props) => {
  if (workspace !== null && !isChanging) {
    return (
      <StepFrame
        title="Workspace connected"
        subtitle="This workspace will be used for your Goodboy setup."
      >
        <div className="flex w-full flex-col items-center gap-3">
          <div className="flex w-full items-center gap-3 rounded-lg border border-success/40 bg-success/10 px-3 py-2.5 text-left">
            <Check size={18} className="shrink-0 text-success" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {workspace.name}
                </span>
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-3xs font-medium text-muted-foreground">
                  {WORKSPACE_KIND_LABELS[workspace.kind ?? 'repo']}
                </span>
              </span>
              <span className="block truncate font-mono text-xs text-muted-foreground/80">
                {workspace.rootPath}
              </span>
            </span>
          </div>
          <Button variant="secondary" onClick={() => onIsChangingChange(true)}>
            <RefreshCw size={14} aria-hidden /> Change workspace
          </Button>
        </div>
      </StepFrame>
    );
  }

  if (audience === null) {
    return (
      <StepFrame
        title="How do you work?"
        subtitle="Goodboy adapts the setup to the kind of work you bring to it."
      >
        <div className="flex flex-col gap-2">
          {AUDIENCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onAudienceChange(option.value)}
              className="flex items-start gap-3 rounded-lg border border-border px-3 py-3 text-left motion-safe:transition-colors hover:border-primary/50 hover:bg-primary/5"
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
          {workspace !== null ? (
            <Button variant="ghost" onClick={() => onIsChangingChange(false)}>
              Cancel
            </Button>
          ) : null}
        </div>
      </StepFrame>
    );
  }

  const onFormComplete = ({ mode }: { readonly mode: WorkspaceLinkMode }) => {
    if (workspace === null && audience === 'developer' && mode === 'single') {
      onIsChangingChange(true);
      return;
    }
    onIsChangingChange(false);
  };

  const onFormCancel = () => {
    if (workspace !== null) {
      onIsChangingChange(false);
      return;
    }
    onAudienceChange(null);
  };

  return (
    <StepFrame
      title={workspace === null ? 'Add workspace' : 'Change workspace'}
      subtitle={
        audience === 'developer'
          ? 'Point Goodboy at a repository, or link several of them into one workspace. Standalone skips git: plain folders, no branch, no diff and no pull requests until you link a code host.'
          : 'Name the workspace and pick where its files live.'
      }
    >
      <WorkspaceLinkForm
        onComplete={onFormComplete}
        onCancel={onFormCancel}
        cancelLabel="Back"
        showBreadcrumb={false}
        modes={AUDIENCE_MODES[audience]}
        draftStorageKey={STORAGE_KEYS.onboardingWorkspaceDraft}
      />
    </StepFrame>
  );
};

type StepFrameProps = {
  readonly title: string;
  readonly subtitle: string;
  readonly children: ReactNode;
};

const StepFrame = ({ title, subtitle, children }: StepFrameProps) => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 text-primary">
        <FolderGit2 size={26} aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      </div>
    </div>

    {children}
  </div>
);
