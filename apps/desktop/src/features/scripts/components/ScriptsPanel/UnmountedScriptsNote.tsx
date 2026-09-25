import type { SessionId, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { MountProjectAction } from '../../../session/components/SessionOverviewPane/ProjectMountRows/MountProjectAction';

export type UnmountedScriptsEntry = {
  readonly projectName: string;
  readonly count: number;
};

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly entries: ReadonlyArray<UnmountedScriptsEntry>;
  readonly hasAction: boolean;
};

const joinNames = ({ names }: { readonly names: ReadonlyArray<string> }): string => {
  if (names.length <= 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

export const UnmountedScriptsNote = ({ sessionId, workspaceId, entries, hasAction }: Props) => {
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  const FolderIcon = CONCEPT_ICONS.projectFolder;
  return (
    <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
      <FolderIcon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
      <p className="min-w-0 flex-1">
        {total} saved {total === 1 ? 'script' : 'scripts'} in{' '}
        {joinNames({ names: entries.map((entry) => entry.projectName) })}, not in this session.
      </p>
      {hasAction ? (
        <MountProjectAction sessionId={sessionId} workspaceId={workspaceId} presentation="button" />
      ) : null}
    </div>
  );
};
