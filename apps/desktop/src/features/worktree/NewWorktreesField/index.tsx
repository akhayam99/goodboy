import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { Project } from '@goodboy/types';
import { Button, Checkbox, EmptyLine, Eyebrow, ICON_SIZE, formatError } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { formatBytes } from '../../../shared/utils/formatBytes';
import {
  worktreeCarryCandidates,
  worktreeSetupProposal,
  type CarryCandidate,
  type SetupProposal,
} from '../worktree';
import { carryPathsOf, carryValueOf, setupCommandOf } from '../newWorktreeSettings';

type Props = {
  readonly project: Project;
};

type Loaded = {
  readonly projectId: Project['id'];
  readonly candidates: ReadonlyArray<CarryCandidate>;
  readonly proposal: SetupProposal | null;
};

type CandidateParams = {
  readonly candidate: CarryCandidate;
};

type ToggleParams = {
  readonly path: string;
  readonly isOn: boolean;
};

const candidateSizeOf = ({ candidate }: CandidateParams): string => {
  if (candidate.isLarge) {
    return 'too large to copy';
  }
  return candidate.sizeBytes === null ? '' : formatBytes({ bytes: candidate.sizeBytes });
};

export const NewWorktreesField = ({ project }: Props) => {
  const readProjectValue = useAppStore((state) => state.readProjectValue);
  const writeProjectValue = useAppStore((state) => state.writeProjectValue);
  const reportError = useAppStore((state) => state.reportError);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [setup, setSetup] = useState('');
  const [isSetupSaved, setIsSetupSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      const [candidates, proposal, carry, saved] = await Promise.all([
        worktreeCarryCandidates({ repoPath: project.rootPath }),
        worktreeSetupProposal({ repoPath: project.rootPath }),
        readProjectValue({ projectId: project.id, key: 'worktree.carry' }),
        readProjectValue({ projectId: project.id, key: 'worktree.setup' }),
      ]);
      if (!isCurrent) {
        return;
      }
      const command = setupCommandOf({ raw: saved });
      setLoaded({ projectId: project.id, candidates, proposal });
      setTicked(new Set(carryPathsOf({ raw: carry })));
      setSetup(command === undefined ? (proposal?.command ?? '') : (command ?? ''));
      setIsSetupSaved(command !== undefined);
    };
    load().catch((failure: unknown) => {
      if (isCurrent) {
        void reportError({ title: "Couldn't read the worktree setup", error: failure });
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [project.id, project.rootPath, readProjectValue, reportError]);

  if (project.kind !== 'repo' || loaded === null || loaded.projectId !== project.id) {
    return null;
  }

  const knownPaths = new Set(loaded.candidates.map((candidate) => candidate.path));
  const missing = [...ticked].filter((path) => !knownPaths.has(path));
  const toggle = ({ path, isOn }: ToggleParams) =>
    setTicked((current) => {
      const rest = [...current].filter((entry) => entry !== path);
      return new Set(isOn ? [...rest, path] : rest);
    });

  const onSave = async () => {
    setIsSaving(true);
    setError(null);
    let previousCarry: string | null | undefined;
    try {
      previousCarry = await readProjectValue({ projectId: project.id, key: 'worktree.carry' });
      await writeProjectValue({
        projectId: project.id,
        key: 'worktree.carry',
        value: carryValueOf({ paths: [...ticked] }),
      });
      await writeProjectValue({
        projectId: project.id,
        key: 'worktree.setup',
        value: setup.trim(),
      });
      setIsSetupSaved(true);
    } catch (failure) {
      if (previousCarry !== undefined) {
        try {
          await writeProjectValue({
            projectId: project.id,
            key: 'worktree.carry',
            value: previousCarry ?? carryValueOf({ paths: [] }),
          });
        } catch (restoreFailure) {
          void reportError({
            title: "Couldn't put the carry list back",
            error: restoreFailure,
          });
        }
      }
      setError(formatError(failure));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section aria-label="Worktree setup" className="flex flex-col gap-2">
      <Eyebrow label="Worktree setup" muted />
      <div className="flex flex-col gap-1">
        <span className="text-meta text-muted-foreground">Carry into every new branch</span>
        {loaded.candidates.length === 0 && missing.length === 0 ? (
          <EmptyLine>No git-ignored file or folder to carry here.</EmptyLine>
        ) : (
          <ul aria-label="Carry into every new branch" className="flex list-none flex-col gap-1">
            {loaded.candidates.map((candidate) => (
              <li key={candidate.path} className="flex min-w-0 items-center gap-2 text-meta">
                <Checkbox
                  checked={ticked.has(candidate.path)}
                  disabled={candidate.isLarge}
                  ariaLabel={`Carry ${candidate.path}`}
                  onChange={(isOn) => toggle({ path: candidate.path, isOn })}
                />
                <span className="min-w-0 flex-1 truncate text-code text-foreground">
                  {candidate.path}
                  {candidate.isDirectory ? '/' : ''}
                </span>
                {candidate.isSecret ? (
                  <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                    <TriangleAlert size={ICON_SIZE.mark} aria-hidden className="text-warning" />
                    secret: only when ticked
                  </span>
                ) : null}
                <span className="shrink-0 text-faint-foreground">
                  {candidateSizeOf({ candidate })}
                </span>
              </li>
            ))}
            {missing.map((path) => (
              <li key={path} className="flex min-w-0 items-center gap-2 text-meta">
                <Checkbox
                  checked
                  ariaLabel={`Carry ${path}`}
                  onChange={(isOn) => toggle({ path, isOn })}
                />
                <span className="min-w-0 flex-1 truncate text-code text-muted-foreground">
                  {path}
                </span>
                <span className="shrink-0 text-faint-foreground">not found here</span>
              </li>
            ))}
          </ul>
        )}
        <span className="text-meta text-faint-foreground">
          Only git-ignored paths, never over a file that is already there.
        </span>
      </div>
      <label className="flex flex-col gap-1 text-meta">
        <span className="text-muted-foreground">Setup after creation</span>
        <input
          type="text"
          value={setup}
          aria-label="Setup after creation"
          placeholder="Nothing to run"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setSetup(event.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-code text-foreground"
        />
        {loaded.proposal !== null && !isSetupSaved ? (
          <span className="text-faint-foreground">proposed from {loaded.proposal.source}</span>
        ) : null}
        <span className="text-faint-foreground">
          Shown on the branch and run only when you click Run.
        </span>
      </label>
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => void onSave()} isBusy={isSaving}>
          Save
        </Button>
        {error === null ? null : (
          <span role="alert" className="text-meta text-danger">
            {error}
          </span>
        )}
      </div>
    </section>
  );
};
