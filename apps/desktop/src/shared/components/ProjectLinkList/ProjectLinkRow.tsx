import { useState } from 'react';
import { Folder, FolderGit2, Unplug, X } from 'lucide-react';
import type { Project } from '@goodboy/types';
import { Chip, InlineConfirm, Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../conceptIcons';
import { NAMES } from '../../names';

type Props = {
  readonly project: Project;
  readonly busy: boolean;
  readonly onUnlink: (params: { readonly project: Project }) => Promise<void>;
};

export const ProjectLinkRow = ({ project, busy, onUnlink }: Props) => {
  const [isConfirming, setConfirming] = useState(false);
  const isRepo = project.kind === 'repo';
  const KindIcon = isRepo ? FolderGit2 : Folder;
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-3 rounded-lg border border-border-soft bg-subtle px-3 py-2">
        <span className="shrink-0 text-muted-foreground">
          <KindIcon size={ICON_SIZE.row} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-row text-foreground">{project.name}</span>
            <Chip
              tone="neutral"
              kind="state"
              bordered={false}
              label={isRepo ? 'Repository' : 'Folder'}
              className="shrink-0"
            />
          </span>
          <span className="block truncate text-code text-muted-foreground">{project.rootPath}</span>
        </span>
        <Tooltip content={`${NAMES.removeLink} to ${project.name}`} anchorClassName="shrink-0">
          <button
            type="button"
            aria-label={`${NAMES.removeLink} to ${project.name}`}
            disabled={busy}
            onClick={() => setConfirming(true)}
            className="rounded-md p-1 text-faint-foreground hover:bg-hover hover:text-foreground"
          >
            <X size={ICON_SIZE.control} aria-hidden />
          </button>
        </Tooltip>
      </div>
      {isConfirming ? (
        <InlineConfirm
          role="danger"
          icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
          title={`${NAMES.removeLink} to ${project.name}?`}
          description="The folder stays on disk. Link it again any time."
          confirmLabel={NAMES.removeLink}
          isBusy={busy}
          onConfirm={async () => {
            await onUnlink({ project });
            setConfirming(false);
          }}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </li>
  );
};
