import { CommandPreview, CopyButton, Eyebrow } from '@goodboy/ui';
import type { WorkspaceGitState } from '@goodboy/types';
import { initCommands } from './initCommands';

type InitState = Extract<WorkspaceGitState, 'absent' | 'unborn'>;

type Props = {
  readonly rootPath: string;
  readonly state: InitState;
};

const HEADLINE: Record<InitState, string> = {
  absent: 'This folder has no git repository yet',
  unborn: 'This repository has no commits yet',
};

const LEDE: Record<InitState, string> = {
  absent:
    'Goodboy runs every session in its own worktree, and a worktree needs a repository with at least one commit. Run these yourself, in this order. Nothing here touches your files until you do.',
  unborn:
    'The repository exists but has nothing to branch from. Commit once and sessions unlock. Goodboy never commits for you.',
};

export const InitGuide = ({ rootPath, state }: Props) => {
  const steps = initCommands({ rootPath, state });

  return (
    <section aria-label="Set up git for this project" className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-1.5">
        <Eyebrow label="Git setup" muted />
        <h3 className="text-xs font-semibold text-foreground">{HEADLINE[state]}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{LEDE[state]}</p>
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
