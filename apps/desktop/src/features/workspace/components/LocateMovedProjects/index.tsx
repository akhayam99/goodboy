import { Button, Notice } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { LocateMovedProjectRow } from './LocateMovedProjectRow';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onChoose: () => void;
};

export const LocateMovedProjects = ({ workspaceId, onChoose }: Props) => {
  const candidates = useAppStore((state) => state.projectRelocationCandidates);
  const completed = useAppStore((state) => state.projectRelocationCompleted);
  const phase = useAppStore((state) => state.projectRelocationPhase);
  const error = useAppStore((state) => state.projectRelocationError);
  const owner = useAppStore((state) => state.projectRelocationWorkspaceId);
  const setSelected = useAppStore((state) => state.setProjectRelocationSelected);
  const relocate = useAppStore((state) => state.relocateProjects);
  const undo = useAppStore((state) => state.undoRelocation);
  const clear = useAppStore((state) => state.clearProjectRelocation);
  if (owner !== workspaceId || phase === 'idle') {
    return null;
  }
  const isBusy = phase === 'moving';
  const selectedCount = candidates.filter(
    (candidate) => candidate.isSelected && candidate.toRoot !== null,
  ).length;
  const sessionFolderCount = completed.reduce(
    (total, relocation) => total + relocation.restoredSessionFolders,
    0,
  );
  const repairFailures = completed.filter((relocation) => !relocation.repairedGitLinks).length;
  if (phase === 'success') {
    return (
      <Notice
        tone="success"
        placement="inline"
        title={`Moved ${completed.length} ${completed.length === 1 ? 'project' : 'projects'}. ${sessionFolderCount} session folders are back.`}
        detail={
          repairFailures === 0
            ? null
            : `Git links could not be repaired for ${repairFailures} projects.`
        }
        actions={
          <Button variant="secondary" size="sm" onClick={() => void undo()}>
            Undo move
          </Button>
        }
      />
    );
  }
  return (
    <section
      aria-labelledby="locate-moved-projects"
      className="flex flex-col gap-4 rounded-lg bg-subtle p-4"
    >
      <div className="flex flex-col gap-1">
        <h3 id="locate-moved-projects" className="text-heading text-foreground">
          Locate moved projects
        </h3>
        <p className="text-label text-muted-foreground">
          Confirm the folders Goodboy should reconnect. Different repositories stay unchanged.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {candidates.map((candidate) => (
          <LocateMovedProjectRow
            key={candidate.projectId}
            candidate={candidate}
            isBusy={isBusy}
            onSelectedChange={setSelected}
            onChoose={onChoose}
          />
        ))}
      </ul>
      {error !== null && (
        <p role="alert" className="text-label text-danger">
          {error}
        </p>
      )}
      <p className="text-label text-muted-foreground">
        Git links get repaired. Session folders move with their project.
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={selectedCount === 0}
          isBusy={isBusy}
          busyLabel="Moving projects…"
          onClick={() => void relocate()}
        >
          Move {selectedCount} {selectedCount === 1 ? 'project' : 'projects'}
        </Button>
        <Button variant="secondary" size="sm" disabled={isBusy} onClick={onChoose}>
          Choose another folder
        </Button>
        <Button variant="ghost" size="sm" disabled={isBusy} onClick={clear}>
          Cancel
        </Button>
      </div>
    </section>
  );
};
