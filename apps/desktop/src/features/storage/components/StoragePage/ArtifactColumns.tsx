import { ARTIFACT_COLUMN } from './artifactColumnClasses';

export const ArtifactColumns = () => (
  <div
    aria-hidden
    className="flex h-6 items-center gap-2.5 px-2 text-eyebrow text-faint-foreground"
  >
    <span className={ARTIFACT_COLUMN.node} />
    <span className="min-w-0 flex-1">Artifact</span>
    <span className={ARTIFACT_COLUMN.workspace}>Workspace</span>
    <span className={ARTIFACT_COLUMN.age}>Deleted</span>
    <span className={ARTIFACT_COLUMN.age}>Last used</span>
    <span className={ARTIFACT_COLUMN.size}>Size</span>
    <span className={ARTIFACT_COLUMN.actions} />
  </div>
);
