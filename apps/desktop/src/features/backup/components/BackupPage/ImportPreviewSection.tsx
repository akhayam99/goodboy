import { Button } from '@goodboy/ui';
import type { ImportPreview } from '@goodboy/types';

const VERDICT_LABEL: Readonly<Record<string, string>> = {
  same_repository: 'Found',
  same_name_unconfirmed: "Same name, can't confirm",
  different_repository: 'Different repository',
  not_found: 'Not found',
};

type Props = {
  readonly preview: ImportPreview;
  readonly workspaceTargets: Readonly<Record<string, string>>;
  readonly onWorkspaceTargetChange: (params: {
    readonly bundleId: string;
    readonly targetId: string | null;
  }) => void;
  readonly onChooseProjectParent: () => void;
  readonly disabled: boolean;
};

export const ImportPreviewSection = ({
  preview,
  workspaceTargets,
  onWorkspaceTargetChange,
  onChooseProjectParent,
  disabled,
}: Props) => {
  const hasUnresolvedProjects = preview.projectMatches.some(
    (project) => !project.hasPath && project.resolvedPath === null,
  );
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-subtle p-4">
      <p className="text-label text-muted-foreground">
        From Goodboy {preview.manifest.exportedAt.slice(0, 10)}. {preview.manifest.workspaceCount}{' '}
        {preview.manifest.workspaceCount === 1 ? 'workspace' : 'workspaces'},{' '}
        {preview.manifest.projectCount} projects, {preview.manifest.workflowCount} workflows.
      </p>
      <ul className="flex flex-col gap-1.5">
        {preview.workspaceMatches.map((match) => {
          const chosenTarget = workspaceTargets[match.bundleId] ?? match.existingId ?? null;
          return (
            <li
              key={match.bundleId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted p-2"
            >
              <span className="text-label text-foreground">{match.name}</span>
              <span className="flex items-center gap-1.5">
                {match.existingId !== null && (
                  <Button
                    variant={chosenTarget === match.existingId ? 'primary' : 'secondary'}
                    size="sm"
                    disabled={disabled}
                    onClick={() =>
                      onWorkspaceTargetChange({
                        bundleId: match.bundleId,
                        targetId: match.existingId,
                      })
                    }
                  >
                    Merge into {match.name}
                  </Button>
                )}
                <Button
                  variant={chosenTarget === null ? 'primary' : 'secondary'}
                  size="sm"
                  disabled={disabled}
                  onClick={() =>
                    onWorkspaceTargetChange({ bundleId: match.bundleId, targetId: null })
                  }
                >
                  Add as a new workspace
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
      {preview.projectMatches.filter((project) => !project.hasPath).length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-label text-muted-foreground">
            This file has no folder paths. Choose where your projects are on this Mac.
          </p>
          <ul className="flex flex-col gap-1">
            {preview.projectMatches
              .filter((project) => !project.hasPath)
              .map((project) => (
                <li
                  key={project.bundleProjectId}
                  className="flex items-center justify-between gap-2 text-label"
                >
                  <span className="text-foreground">{project.name}</span>
                  <span className="text-muted-foreground">
                    {project.resolvedPath ?? VERDICT_LABEL[project.verdict] ?? project.verdict}
                  </span>
                </li>
              ))}
          </ul>
          <Button variant="secondary" size="sm" disabled={disabled} onClick={onChooseProjectParent}>
            Choose folder
          </Button>
          {hasUnresolvedProjects && (
            <p className="text-secondary text-faint-foreground">
              Projects left unresolved are skipped, nothing is deleted.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
