import { useState } from 'react';
import { Button, CommandPreview, CopyButton, Eyebrow, formatError } from '@goodboy/ui';
import type { WorkspaceGitState } from '@goodboy/types';
import { initCommands } from './initCommands';

type InitState = Extract<WorkspaceGitState, 'absent' | 'unborn'>;

type Props = {
  readonly rootPath: string;
  readonly state: InitState;
  readonly onStart: () => Promise<void>;
};

const HEADLINE: Record<InitState, string> = {
  absent: 'This folder has no git repository yet',
  unborn: 'This repository has no commits yet',
};

const LEDE: Record<InitState, string> = {
  absent:
    'Every session runs in its own worktree, and a worktree needs a repository with at least one commit.',
  unborn:
    'This repository has nothing to branch from yet. Make the first commit to start sessions.',
};

const ACTION: Record<InitState, string> = {
  absent: 'Start a repository',
  unborn: 'Make the first commit',
};

export const InitGuide = ({ rootPath, state, onStart }: Props) => {
  const steps = initCommands({ rootPath, state });
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const start = async () => {
    setPending(true);
    setFailure(null);
    try {
      await onStart();
    } catch (error) {
      setFailure(formatError(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <section aria-label="Set up git for this project" className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-1.5">
        <Eyebrow label="Git setup" muted />
        <h3 className="text-label font-semibold text-foreground">{HEADLINE[state]}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{LEDE[state]}</p>
        <p className="text-secondary text-faint-foreground">
          Goodboy commits a .gitignore and nothing else. Your files stay as they are.
        </p>
        <div className="flex flex-col items-start gap-1.5">
          <Button type="button" size="sm" disabled={pending} aria-busy={pending} onClick={start}>
            {ACTION[state]}
          </Button>
          {failure !== null ? (
            <p role="alert" className="text-secondary text-danger">
              {failure}
            </p>
          ) : null}
        </div>
      </div>
      <details className="flex flex-col gap-3">
        <summary className="cursor-pointer text-label text-muted-foreground">
          Or run it yourself
        </summary>
        <ol className="mt-3 flex flex-col gap-3">
          {steps.map((step, index) => (
            <li key={step.command} className="flex gap-2">
              <span
                aria-hidden
                className="w-3 shrink-0 text-2xs font-semibold leading-5 tabular-nums text-faint-foreground"
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
      </details>
    </section>
  );
};
