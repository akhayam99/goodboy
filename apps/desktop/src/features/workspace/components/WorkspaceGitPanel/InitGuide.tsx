import { Eyebrow } from '@goodboy/ui';
import type { WorkspaceGitState } from '@goodboy/types';
import { CommandPreview } from '@goodboy/ui';
import { CopyButton } from '@goodboy/ui';
import { initCommands } from './initCommands';

type Props = {
  readonly rootPath: string;
  readonly state: WorkspaceGitState;
};

const HEADLINE = {
  absent: 'This folder has no git repository yet',
  unborn: 'This repository has no commits yet',
} as const;

const LEDE = {
  absent:
    'Goodboy runs every session in its own worktree, and a worktree needs a repository with at least one commit. Run these yourself, in this order. Nothing here touches your files until you do.',
  unborn:
    'The repository exists but has nothing to branch from. Commit once and sessions unlock. Goodboy never commits for you.',
} as const;

export const InitGuide = ({ rootPath, state }: Props) => {
  const steps = initCommands({ rootPath, state });
  const variant = state === 'unborn' ? 'unborn' : 'absent';

  return (
    <section aria-label="Set up git for this project" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Eyebrow label="Git setup" muted />
        <h3 className="text-xs font-semibold text-foreground">{HEADLINE[variant]}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{LEDE[variant]}</p>
        <p className="text-2xs text-muted-foreground/70">
          Sessions stay unavailable until the first commit exists.
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => (
          <li key={step.command} className="flex gap-2">
            <span
              aria-hidden
              className="w-3 shrink-0 text-2xs font-semibold leading-5 tabular-nums text-muted-foreground/60"
            >
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 text-xs font-medium leading-5 text-foreground">
                  {step.title}
                </span>
                <CopyButton
                  presentation="icon"
                  value={step.command}
                  label={`copy command: ${step.title}`}
                />
              </div>
              <p className="text-2xs leading-relaxed text-muted-foreground">{step.detail}</p>
              <CommandPreview command={step.command} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};
