import type { ReactNode } from 'react';
import { Folder, FolderGit2, Unplug, X } from 'lucide-react';
import type { Project } from '@goodboy/types';
import { Chip, ConfirmPopover, Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../conceptIcons';

type Props = {
  readonly project: Project;
  readonly busy: boolean;
  readonly accessory: ReactNode;
  readonly detail?: ReactNode;
  readonly onUnlink: (params: { readonly project: Project }) => Promise<void>;
};

export const ProjectLinkRow = ({ project, busy, accessory, detail, onUnlink }: Props) => {
  const isRepo = project.kind === 'repo';
  const KindIcon = isRepo ? FolderGit2 : Folder;
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border-soft bg-subtle px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-muted-foreground">
          <KindIcon size={ICON_SIZE.row} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{project.name}</span>
            <Chip
              tone="neutral"
              size="3xs"
              bordered={false}
              label={isRepo ? 'Repository' : 'Folder'}
              className="shrink-0"
            />
          </span>
          <span className="block truncate font-mono text-xs text-muted-foreground">
            {project.rootPath}
          </span>
        </span>
        {accessory}
        <ConfirmPopover
          role="alert"
          icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
          title={`Unlink ${project.name}?`}
          description="The folder stays on disk. Link it again any time."
          confirmLabel="Unlink"
          isBusy={busy}
          onConfirm={() => onUnlink({ project })}
          trigger={({ isArmed, arm }) => (
            <Tooltip content={`Unlink ${project.name}`} anchorClassName="shrink-0">
              <button
                type="button"
                aria-label={`Unlink ${project.name}`}
                aria-expanded={isArmed}
                disabled={busy}
                onClick={arm}
                className="rounded-md p-1 text-faint-foreground hover:bg-hover hover:text-foreground"
              >
                <X size={ICON_SIZE.control} aria-hidden />
              </button>
            </Tooltip>
          )}
        />
      </div>
      {detail}
    </li>
  );
};
