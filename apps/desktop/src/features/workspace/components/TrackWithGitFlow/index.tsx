import { useEffect, useId, useState } from 'react';
import { Button, FormActions, SkeletonText, formatError } from '@goodboy/ui';
import type { Project } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ConvertedProject } from '../../../../store/slices/projects/convertProjectToRepo';
import { IntroLine } from './IntroLine';
import { PlanEntryRow } from './PlanEntryRow';
import { fileCountLabel } from './fileCountLabel';
import { firstCommitCount } from './firstCommitCount';

type ToggleParams = {
  readonly key: string;
};

type Props = {
  readonly project: Project;
  readonly onCancel: () => void;
  readonly onTracked: (converted: ConvertedProject) => void;
};

export const TrackWithGitFlow = ({ project, onCancel, onTracked }: Props) => {
  const projectId = project.id;
  const headingId = useId();
  const plan = useAppStore((state) => state.firstCommitPlans[projectId] ?? null);
  const loadFirstCommitPlan = useAppStore((state) => state.loadFirstCommitPlan);
  const convertProjectToRepo = useAppStore((state) => state.convertProjectToRepo);
  const [included, setIncluded] = useState<ReadonlyArray<string>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);
    loadFirstCommitPlan({ projectId })
      .catch((err: unknown) => setLoadError(formatError(err)))
      .finally(() => setIsLoading(false));
  }, [attempt, loadFirstCommitPlan, projectId]);

  const toggle = ({ key }: ToggleParams) =>
    setIncluded((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
    );

  const commit = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const converted = await convertProjectToRepo({ projectId, include: included });
      onTracked(converted);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setIsBusy(false);
    }
  };

  const count = plan === null ? 0 : firstCommitCount({ plan, included });

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-lg bg-muted p-4">
      <h3 id={headingId} className="text-row text-foreground">
        Track {project.name} with git
      </h3>
      {plan === null && isLoading ? (
        <div role="status" aria-label={`Reading ${project.name}`}>
          <SkeletonText lines={5} />
        </div>
      ) : null}
      {plan === null && loadError !== null ? (
        <FormActions leading={<span className="text-label text-danger">{loadError}</span>}>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => setAttempt((current) => current + 1)}>
            Retry
          </Button>
        </FormActions>
      ) : null}
      {plan === null ? null : (
        <>
          <IntroLine plan={plan} />
          <ul
            aria-label="What goes in the first commit"
            className="flex flex-col rounded-md bg-background py-1 ring-1 ring-inset ring-border-soft"
          >
            {plan.entries.map((entry) => (
              <PlanEntryRow
                key={`${entry.kind}:${entry.key}`}
                entry={entry}
                isIncluded={included.includes(entry.key)}
                isDisabled={isBusy}
                onToggle={toggle}
              />
            ))}
          </ul>
          <p className="text-label text-muted-foreground">
            {plan.hasIgnoreFile
              ? 'Goodboy adds the left out paths to .gitignore, which is part of the commit.'
              : 'Goodboy writes the left out paths to a new .gitignore, which is part of the commit.'}{' '}
            A commit stays in the history once it is made.
          </p>
          <FormActions
            leading={
              error === null ? (
                <span className="text-label text-muted-foreground">
                  {fileCountLabel({ count })} in the first commit
                </span>
              ) : (
                <span role="alert" className="text-label text-danger">
                  {error}
                </span>
              )
            }
          >
            <Button variant="ghost" onClick={onCancel} disabled={isBusy}>
              Cancel
            </Button>
            <Button
              onClick={() => void commit()}
              disabled={isBusy || count === 0}
              aria-busy={isBusy}
            >
              <span className={isBusy ? 'text-shimmer' : undefined}>Make the first commit</span>
            </Button>
          </FormActions>
        </>
      )}
    </section>
  );
};
